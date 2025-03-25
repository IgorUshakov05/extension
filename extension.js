const vscode = require("vscode");

async function getResponse(text) {
  try {
    let response = await fetch("https://ai.webhunt.ru/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text:
          text + ": стек технологий: PySide6, SQLAlchemy, psycopg2, PostgreSQL, ответь на русском",
      }),
    });
    let answer = await response.json();
    return { success: true, text: answer.response };
  } catch (e) {
    console.error("Ошибка запроса:", e);
    return { success: false, text: "Ошибка: " + e.message };
  }
}

function activate(context) {
  console.log('Your extension "chatbot" is now active!');

  const disposable = vscode.commands.registerCommand(
    "igorsexy.helloWorld",
    function () {
      const panel = vscode.window.createWebviewPanel(
        "chatbot",
        "Igor sexy boy?",
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      panel.webview.html = getWebviewContent();

      panel.webview.onDidReceiveMessage(async (message) => {
        let text = message.text;
        let response = await getResponse(text);
        panel.webview.postMessage({ text: response.text });
      });
    }
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}

function getWebviewContent() {
  return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Chatbot</title>
      <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
      <style>
        body {
          font-family: Consolas, "Courier New", monospace;
          background-color: #1e1e1e;
          color: #d4d4d4;
          display: flex;
          flex-direction: column;
          height: 100vh;
          padding: 10px;
        }
        #messages {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background-color: #252526;
          border-radius: 5px;
        }
        .message {
          margin-bottom: 10px;
          padding: 10px;
          border-radius: 5px;
        }
        .user {
          background-color: #007acc;
          color: #fff;
          text-align: right;
        }
        .bot {
          background-color: #333;
        }
        pre {
          background-color: #2d2d2d;
          padding: 10px;
          border-radius: 5px;
          overflow-x: auto;
          cursor: pointer;
        }
        code {
          display: block;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        #input-container {
          display: flex;
          margin-top: 10px;
        }
        #input {
          flex: 1;
          padding: 10px;
          background-color: #252526;
          color: #d4d4d4;
          border: 1px solid #3c3c3c;
          border-radius: 5px;
        }
        #send {
          margin-left: 10px;
          padding: 10px;
          background-color: #007acc;
          color: #fff;
          border: none;
          cursor: pointer;
          border-radius: 5px;
        }
        #send:hover {
          background-color: #005f9e;
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

        function addMessage(text, sender) {
          const msgDiv = document.createElement("div");
          msgDiv.className = "message " + sender;
          if (sender === "bot") {
            msgDiv.innerHTML = marked.parse(text); // Рендер Markdown
            addCodeCopyListeners(msgDiv); // Добавляем слушателей для копирования кода
          } else {
            msgDiv.textContent = text;
          }
          messages.appendChild(msgDiv);
          messages.scrollTop = messages.scrollHeight;
        }

        function addCodeCopyListeners(msgDiv) {
          // Находим все блоки кода и добавляем обработчик
          const codeBlocks = msgDiv.querySelectorAll('pre code');
          codeBlocks.forEach(block => {
            block.parentElement.addEventListener('click', () => {
              const text = block.textContent;
              navigator.clipboard.writeText(text).then(() => {
                alert('Код скопирован в буфер обмена!');
              });
            });
          });
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
      </script>
    </body>
    </html>
  `;
}

module.exports = { activate, deactivate };
