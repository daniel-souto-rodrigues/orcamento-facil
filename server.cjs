const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const host = '127.0.0.1';
const port = 4300;
const quotesDirectory = path.join(__dirname, '0- Rascunhos');
const legacyQuotesDirectory = path.join(__dirname, 'orçamentos');
const pdfDirectory = path.join(__dirname, '1- Orcamentos pdf');
const logosDirectory = path.join(__dirname, 'logos');
const maxRequestSize = 8 * 1024 * 1024;
const maxPdfSize = 32 * 1024 * 1024;

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function safeClientName(client) {
  const name = client
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 80);

  if (!name || name === '.' || name === '..') return 'Cliente';
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name) ? `_${name}` : name;
}

function localDateAndTime(date) {
  const part = (value) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}`,
    time: `${part(date.getHours())}-${part(date.getMinutes())}-${part(date.getSeconds())}`,
  };
}

function mimeForImageExtension(extension) {
  return {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
  }[extension];
}

function getImageExtension(mimeType, bytes) {
  if (mimeType === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return '.png';
  }
  if (mimeType === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return '.jpg';
  }
  if (mimeType === 'image/webp'
    && bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP') {
    return '.webp';
  }
  return null;
}

async function listSavedQuotes() {
  const directories = [quotesDirectory, legacyQuotesDirectory];
  const quoteFiles = await Promise.all(directories.map(async (directory) => {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
        .map((entry) => entry.name);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }));
  return [...new Set(quoteFiles.flat())].sort((left, right) => right.localeCompare(left, 'pt-BR'));
}

let savedQuoteNames = [];
const savedQuoteNamesReady = listSavedQuotes().then((names) => {
  savedQuoteNames = names;
});

async function readRequestBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxRequestSize) {
      const error = new Error('O arquivo enviado excede o limite de 8 MB.');
      error.statusCode = 413;
      throw error;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Os dados enviados não são um JSON válido.');
    error.statusCode = 400;
    throw error;
  }
}

async function readPdfBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxPdfSize) {
      const error = new Error('O PDF excede o limite de 32 MB.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
    if (request.method === 'POST' && url.pathname === '/api/pdfs') {
      const client = (url.searchParams.get('client') || '').trim();
      if (!client) return sendJson(response, 400, { error: 'Informe o cliente para salvar o PDF.' });
      const pdf = await readPdfBody(request);
      if (pdf.length < 5 || pdf.toString('ascii', 0, 5) !== '%PDF-') {
        return sendJson(response, 415, { error: 'O conteúdo enviado não é um PDF válido.' });
      }

      const { date, time } = localDateAndTime(new Date());
      const clientName = safeClientName(client);
      await fs.mkdir(pdfDirectory, { recursive: true });
      const baseName = `${date}-${time}-${clientName}`;
      let fileName = `${baseName}.pdf`;
      let suffix = 1;
      while (true) {
        try {
          await fs.writeFile(path.join(pdfDirectory, fileName), pdf, { flag: 'wx' });
          break;
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          fileName = `${baseName}-${String(suffix).padStart(2, '0')}.pdf`;
          suffix += 1;
        }
      }
      const filePath = path.relative(__dirname, path.join(pdfDirectory, fileName));
      return sendJson(response, 201, { filePath });
    }
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(response, 200, { status: 'ok' });
    }
    if (request.method === 'GET' && url.pathname === '/api/quotes') {
      await savedQuoteNamesReady;
      return sendJson(response, 200, { quotes: savedQuoteNames });
    }
    if (request.method === 'GET' && url.pathname.startsWith('/api/quotes/')) {
      const fileName = decodeURIComponent(url.pathname.slice('/api/quotes/'.length));
      if (!fileName || path.basename(fileName) !== fileName || !fileName.toLowerCase().endsWith('.json')) {
        return sendJson(response, 400, { error: 'Nome de arquivo de orçamento inválido.' });
      }
      let contents;
      try {
        contents = await fs.readFile(path.join(quotesDirectory, fileName), 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        contents = await fs.readFile(path.join(legacyQuotesDirectory, fileName), 'utf8');
      }
      return sendJson(response, 200, JSON.parse(contents));
    }
    if (request.method === 'GET' && url.pathname.startsWith('/logos/')) {
      const fileName = decodeURIComponent(url.pathname.slice('/logos/'.length));
      if (!fileName || path.basename(fileName) !== fileName) {
        return sendJson(response, 400, { error: 'Nome de logo inválido.' });
      }
      const extension = path.extname(fileName).toLowerCase();
      const mimeType = mimeForImageExtension(extension);
      if (!mimeType) return sendJson(response, 404, { error: 'Logo não encontrada.' });
      const image = await fs.readFile(path.join(logosDirectory, fileName));
      response.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      });
      return response.end(image);
    }
    if (request.method !== 'POST' || (url.pathname !== '/api/quotes' && url.pathname !== '/api/logos')) {
      return sendJson(response, 404, { error: 'Rota não encontrada.' });
    }

    const payload = await readRequestBody(request);
    if (url.pathname === '/api/logos') {
      if (typeof payload?.companyName !== 'string' || typeof payload?.base64 !== 'string') {
        return sendJson(response, 400, { error: 'Selecione uma imagem de logo válida.' });
      }
      const bytes = Buffer.from(payload.base64, 'base64');
      if (bytes.length === 0 || bytes.length > 5 * 1024 * 1024) {
        return sendJson(response, 413, { error: 'A logo deve ter até 5 MB.' });
      }
      const extension = getImageExtension(payload.mimeType, bytes);
      if (!extension) {
        return sendJson(response, 415, { error: 'Formato de logo não suportado. Use PNG, JPEG ou WebP.' });
      }

      const { date, time } = localDateAndTime(new Date());
      const clientName = safeClientName(payload.companyName);
      await fs.mkdir(logosDirectory, { recursive: true });
      let fileName = `${clientName}-${date}-${time}${extension}`;
      let suffix = 1;
      while (true) {
        try {
          await fs.writeFile(path.join(logosDirectory, fileName), bytes, { flag: 'wx' });
          break;
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          suffix += 1;
          fileName = `${clientName}-${date}-${time}-${String(suffix).padStart(2, '0')}${extension}`;
        }
      }
      return sendJson(response, 201, { logoPath: `/logos/${encodeURIComponent(fileName)}` });
    }

    const client = typeof payload?.quote?.client === 'string' ? payload.quote.client.trim() : '';
    if (!client) {
      return sendJson(response, 400, { error: 'Informe o cliente antes de salvar o orçamento.' });
    }

    const savedAt = new Date();
    const { date, time } = localDateAndTime(savedAt);
    const clientName = safeClientName(client);
    await fs.mkdir(quotesDirectory, { recursive: true });

    let fileName = `${clientName}-${date}-${time}.json`;
    let suffix = 1;
    while (true) {
      try {
        await fs.writeFile(
          path.join(quotesDirectory, fileName),
          `${JSON.stringify({ savedAt: savedAt.toISOString(), ...payload }, null, 2)}\n`,
          { encoding: 'utf8', flag: 'wx' },
        );
        break;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        suffix += 1;
        fileName = `${clientName}-${date}-${time}-${String(suffix).padStart(2, '0')}.json`;
      }
    }

    savedQuoteNames = [fileName, ...savedQuoteNames.filter((name) => name !== fileName)]
      .sort((left, right) => right.localeCompare(left, 'pt-BR'));
    const filePath = path.relative(__dirname, path.join(quotesDirectory, fileName));
    return sendJson(response, 201, { filePath });
  } catch (error) {
    console.error('Falha no serviço local de orçamentos.', error);
    if (error.code === 'ENOENT') {
      return sendJson(response, 404, { error: 'O arquivo solicitado não foi encontrado.' });
    }
    if (error instanceof SyntaxError) {
      return sendJson(response, 500, { error: 'Um orçamento salvo contém JSON inválido.' });
    }
    return sendJson(response, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'Falha ao gravar o arquivo na pasta do programa.',
    });
  }
});

server.listen(port, host, () => {
  console.log(`Serviço local de orçamentos disponível em http://${host}:${port}`);
});
