const vscode = require("vscode");
const path = require("path");
let activePanel = null; // Сохраняем WebView
let messageQueue = []; // Очередь сообщений для отправки после повторного открытия WebView

async function getResponse(text) {
  try {
    let response = await fetch("https://ai.webhunt.ru/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          text +
          ": стек технологий: PySide6, SQLAlchemy, mysql, ответь на русском",
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
          background-color: rgb(12, 12, 12);
          color: #fff;
          text-align: right;
        }
        .bot {
          background-color: #333;
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
          background-color: rgb(12, 12, 12);
          color: #fff;
          border: none;
          cursor: pointer;
          border-radius: 5px;
        }
        #send:hover {
          background-color: rgb(25, 25, 25);
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
