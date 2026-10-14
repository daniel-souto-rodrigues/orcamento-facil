# Orçamento de Serviços

Aplicação Angular de página única para preencher, pré-visualizar e imprimir um orçamento de serviços em papel A4.

## Executar

Este projeto usa Angular 22 e precisa do Node.js 22.22.3 ou superior na linha 22. Com o NVM for Windows, abra o Prompt de Comando na pasta do projeto e selecione a versão:

```bat
nvm install 22.22.3
nvm use 22.22.3
set "PATH=%NVM_SYMLINK%;%PATH%"
node --version
```

Confirme que o comando mostra `v22.22.3` antes de iniciar. Colocar o link do NVM no início do `PATH` evita que outra instalação do Node no Windows tenha prioridade.

Depois, instale as dependências e inicie a aplicação (o comando inicia o app e o serviço local de gravação):

```bash
npm install
npm start
```

Abra `http://localhost:4200/`, preencha os dados e selecione **Salvar**. O rascunho será gravado como arquivo JSON na pasta `0- Rascunhos`, no formato `<Cliente>-<data>-<hora>.json`. **Abrir** lista os rascunhos e permite carregá-los novamente no formulário.

Use **Inserir logo** na seção da empresa para salvar uma imagem PNG, JPEG ou WebP em `logos/`. O orçamento salvo referencia a logo pelo caminho `/logos/<arquivo>`. Cada salvamento cria um novo arquivo; se dois salvamentos ocorrerem no mesmo segundo para o mesmo cliente, um sufixo numérico evita sobrescrever o anterior. A preferência de tema claro/escuro permanece salva neste navegador.

**Salvar Como PDF** gera o documento A4 e grava automaticamente em `1- Orcamentos pdf`, com nome `<yyyy-MM-dd-hh-mm-ss>-<Cliente>.pdf`. **Imprimir** continua abrindo a janela de impressão do navegador. Os serviços são organizados em páginas de até 10 itens, com o cabeçalho da tabela repetido.

## Compilar

```bash
npm run build
```

## Criar um executável para Windows

O projeto gera um aplicativo portátil Windows x64 com interface e serviço local empacotados. Para gerar o executável:

```bash
npm install
npm run desktop:build
```

O arquivo `Orcamento-Facil-0.0.0-x64.exe` será criado na pasta irmã `Orcamento-Facil-para-enviar`, fora do diretório do código-fonte. Envie esse `.exe` para a pessoa destinatária; não é necessário instalar Node.js. Na primeira execução, o Windows pode exibir um aviso do SmartScreen porque o executável não tem assinatura digital.

Os dados ficam em pastas ao lado do executável: `0- Rascunhos`, `1- Orcamentos pdf` e `logos`. Mantenha o executável em uma pasta na qual a pessoa tenha permissão para criar arquivos. O botão **Imprimir** continua usando a janela de impressão do sistema; **Salvar Como PDF** grava diretamente na pasta de PDFs.
