const vscode = require("vscode");
const path = require("path");
let activePanel = null; // Сохраняем WebView
let messageQueue = []; // Очередь сообщений для отправки после повторного открытия WebView

async function getResponse(text) {
  try {
    let hello = await fetch("https://ai.webhunt.ru/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          text +
          ": стек технологий: PySide6, SQLAlchemy, mysql, все напиши в одном файле, разработай интерфейс и разработай 3 таблицы, чтобы связи были многие ко многим,ответь на русском",
      }),
    });
    let answer = await hello.json();
    return { success: true, text: answer.response };
  } catch (e) {
    console.error("Ошибка запроса:", e);
    return { success: false, text: "Ошибка: " + e.message };
  }
}

async function editFile(text) {
  try {
    let hello = await fetch("https://ai.webhunt.ru/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          text +
          ": стек технологий: PySide6, SQLAlchemy, mysql, все напиши в одном файле,  дай код и если есть слова то сразу комментируй,ответ не в формате markdown, твой ответ идет в фалй .py",
      }),
    });
    let answer = await hello.json();
    return { success: true, text: answer.response };
  } catch (e) {
    console.error("Ошибка запроса:", e);
    return { success: false, text: "Ошибка: " + e.message };
  }
}
async function generateCodeUnderSelectedText(editor) {
  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (selectedText.trim() === "") {
    vscode.window.showInformationMessage("Выделите текст для генерации кода.");
    return;
  }

  const response = await editFile(selectedText);

  if (response.success) {
    const code = response.text;
    const position = new vscode.Position(selection.end.line + 1, 0); // Ставим курсор на следующую строку после выделенного текста
    editor.edit((editBuilder) => {
      editBuilder.insert(position, `\n// Сгенерированный код:\n${code}\n`);
    });
  } else {
    vscode.window.showErrorMessage("Ошибка генерации кода: " + response.text);
  }
}
function activate(context) {
  console.log('Your extension "chatbot" is now active!');

  context.subscriptions.push(
    vscode.commands.registerCommand("igorsexy.helloWorld", () => {
      if (activePanel) {
        activePanel.reveal(vscode.ViewColumn.One); // Если WebView уже открыт, просто показываем
      } else {
        activePanel = vscode.window.createWebviewPanel(
          "chatbot",
          "main.py",
          vscode.ViewColumn.One,
          { enableScripts: true }
        );
        const iconPath = vscode.Uri.file(
          path.join(context.extensionPath, "media", "image.png")
        );
        activePanel.iconPath = iconPath;
        activePanel.webview.html = getWebviewContent();

        activePanel.onDidDispose(() => {
          activePanel = null; // Очистка ссылки при закрытии
        });

        // Отправляем сохранённые сообщения при открытии WebView
        if (messageQueue.length > 0) {
          messageQueue.forEach((msg) => activePanel.webview.postMessage(msg));
          messageQueue = []; // Очистка очереди после отправки
        }

        // Слушаем сообщения от WebView
        activePanel.webview.onDidReceiveMessage(async (message) => {
          let response = await getResponse(message.text);

          // Если WebView открыт — отправляем ответ
          if (activePanel) {
            activePanel.webview.postMessage({ text: response.text });
          } else {
            // Если WebView закрыт — сохраняем ответ в очередь
            messageQueue.push({ text: response.text });
          }
        });
      }
    })
  );


  // Команда для генерации кода под выделенным текстом
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.igorOnHelp", async function () {
      
      const editor = vscode.window.activeTextEditor;
      vscode.window.showInformationMessage(editor);
      
      if (editor) {
        vscode.window.showInformationMessage("Ладно, давай помогу!");
        await generateCodeUnderSelectedText(editor);
      }
    })
  );
}

function deactivate() {}

function getWebviewContent() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chatbot</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    :root {
      --background: var(--vscode-editor-background);
      --foreground: var(--vscode-editor-foreground);
      --input-background: var(--vscode-input-background);
      --input-foreground: var(--vscode-input-foreground);
      --border: var(--vscode-input-border);
      --button-bg: var(--vscode-button-background);
      --button-fg: var(--vscode-button-foreground);
    }

    body {
      font-family: Consolas, "Courier New", monospace;
      background-color: var(--background);
      color: var(--foreground);
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 10px;
    }

    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      background-color: var(--input-background);
      border-radius: 5px;
      border: 1px solid var(--border);
    }

    .message {
      margin-bottom: 10px;
      padding: 10px;
      border-radius: 5px;
    }

    .user {
      background-color: rgba(255, 255, 255, 0.1);
      color: var(--foreground);
      text-align: right;
    }

    .bot {
      background-color: rgba(255, 255, 255, 0.2);
    }

    pre {
      background-color: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      cursor: pointer;
      user-select: none;
    }

    #input-container {
      display: flex;
      margin-top: 10px;
    }

    #input {
      flex: 1;
      padding: 10px;
      background-color: var(--input-background);
      color: var(--input-foreground);
      border: 1px solid var(--border);
      border-radius: 5px;
    }

    #send {
      margin-left: 10px;
      padding: 10px;
      background-color: var(--button-bg);
      color: var(--button-fg);
      border: none;
      cursor: pointer;
      border-radius: 5px;
    }

    #send:hover {
      filter: brightness(1.1);
    }
  </style>
</head>
<body>
  <div id="messages"></div>
  <div id="input-container">
    <input type="text" id="input" placeholder="Напишите сообщение..." />
    <button id="send">Отправить</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const input = document.getElementById("input");
    const messages = document.getElementById("messages");
    const sendBtn = document.getElementById("send");

    let state = vscode.getState() || { history: [] };

    function renderMessages() {
      messages.innerHTML = "";
      state.history.forEach(({ text, sender }) => addMessage(text, sender, false));
    }

    function addMessage(text, sender, save = true) {
      const msgDiv = document.createElement("div");
      msgDiv.className = "message " + sender;
      if (sender === "bot") {
        msgDiv.innerHTML = marked.parse(text);
        // Добавление возможности копирования по клику на блоки кода
        const codeBlocks = msgDiv.querySelectorAll("pre code");
        codeBlocks.forEach((codeBlock) => {
          codeBlock.parentElement.addEventListener("click", () => {
            navigator.clipboard.writeText(codeBlock.textContent).then(() => {
              alert("Код скопирован в буфер обмена!");
            }).catch((err) => {
              console.error("Ошибка копирования в буфер обмена:", err);
            });
          });
        });
      } else {
        msgDiv.textContent = text;
      }
      messages.appendChild(msgDiv);
      messages.scrollTop = messages.scrollHeight;
      if (save) {
        state.history.push({ text, sender });
        vscode.setState(state);
      }
    }

    function sendMessage() {
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, "user");
      vscode.postMessage({ text });
      input.value = "";
    }

    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") sendMessage();
    });

    sendBtn.addEventListener("click", sendMessage);

    window.addEventListener("message", function (event) {
      const message = event.data;
      addMessage(message.text, "bot");
    });

    renderMessages();
  </script>
</body>
</html>
`;
}

module.exports = { activate, deactivate };
