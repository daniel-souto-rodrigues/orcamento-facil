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

Atualmente, `npm run build` gera somente a versão web em `dist/orcamento-servicos/browser`; ainda não há configuração de empacotamento nem um comando que gere um `.exe`. Para distribuir como aplicativo desktop, é necessário adicionar um invólucro Electron e empacotar juntos a interface compilada, o serviço local `server.cjs` e o runtime do Node.js. O serviço precisa continuar ativo para salvar e abrir rascunhos e PDFs.

Fluxo recomendado para preparar essa distribuição:

1. Instale o Node.js 22.22.3 e as dependências do projeto, conforme a seção **Executar**.
2. Gere e valide a interface com `npm run build`.
3. Integre Electron ao projeto, criando o processo principal para iniciar e encerrar `server.cjs` junto com a janela do aplicativo. Configure a janela para carregar a interface compilada servida localmente — não abra o `index.html` diretamente como arquivo, pois as chamadas `/api` dependem do serviço local.
4. Configure o empacotador para incluir `dist/orcamento-servicos/browser`, `server.cjs` e o runtime do Electron/Node. Gere o instalador em Windows com o comando de distribuição configurado pelo empacotador.
5. Teste o instalador em uma máquina sem ambiente de desenvolvimento: abra o aplicativo, salve um rascunho, gere um PDF e confirme que os arquivos aparecem em `0- Rascunhos` e `1- Orcamentos pdf` ao lado do executável ou em uma pasta de dados configurada.

O instalador desktop ainda não pode ser gerado apenas seguindo comandos neste repositório: os arquivos de inicialização e a configuração do Electron/empacotador precisam ser implementados primeiro. Enquanto isso, a aplicação pode ser executada no navegador com `npm start`.
