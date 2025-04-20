const vscode = require("vscode");
let isWriting = false;
let timer = null;
let currentIndex = 0;
function generateText(editor) {
  if (!isWriting || currentIndex >= templateText.length) return;

  timer = setTimeout(() => {
    const position = editor.selection.end;

    editor
      .edit((editBuilder) => {
        editBuilder.insert(position, templateText[currentIndex]);
      })
      .then(() => {
        currentIndex++;
        generateText(editor); 
      });
  }, 100);
}
const path = require("path");
let activePanel = null;
let messageQueue = [];
const templateText = `import sys
from PySide6.QtWidgets import (QApplication, QMainWindow, QPushButton, QVBoxLayout, QWidget,
                               QLabel, QLineEdit, QTableWidget, QTableWidgetItem, QComboBox,
                               QMessageBox, QHBoxLayout, QDialog, QFormLayout, QDialogButtonBox, QDateEdit)
from PySide6.QtGui import QIcon
from PySide6.QtCore import Qt, QDate
from sqlalchemy import (create_engine, Column, Integer, String, Date, ForeignKey, select, distinct)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

# Настройки подключения к БД
DB_URI = 'postgresql+psycopg2://postgres:pass@localhost:5432/database'
engine = create_engine(DB_URI)
Session = sessionmaker(bind=engine)
Base = declarative_base()

# Модели
class Person(Base):
    __tablename__ = 'persons'
    id = Column(Integer, primary_key=True)
    full_name = Column(String)
    passport_series = Column(String)
    passport_number = Column(String)
    address = Column(String)
    positions = relationship("Position", back_populates="person", cascade="all, delete")

class Company(Base):
    __tablename__ = 'companies'
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True)
    positions = relationship("Position", back_populates="company", cascade="all, delete")

class Position(Base):
    __tablename__ = 'positions'
    id = Column(Integer, primary_key=True)
    title = Column(String)
    start_date = Column(Date)
    person_id = Column(Integer, ForeignKey('persons.id'))
    company_id = Column(Integer, ForeignKey('companies.id'))

    person = relationship("Person", back_populates="positions")
    company = relationship("Company", back_populates="positions")

Base.metadata.create_all(engine)

# Диалог для ввода данных
class EmployeeDialog(QDialog):
    def __init__(self, data=None):
        super().__init__()
        self.setWindowTitle("Форма сотрудника")
        layout = QFormLayout()

        self.full_name = QLineEdit()
        self.passport_series = QLineEdit()
        self.passport_number = QLineEdit()
        self.address = QLineEdit()
        self.company = QLineEdit()
        self.position = QLineEdit()
        self.start_date = QDateEdit()
        self.start_date.setCalendarPopup(True)
        self.start_date.setDate(QDate.currentDate())

        if data:
            self.full_name.setText(data['full_name'])
            self.passport_series.setText(data['passport_series'])
            self.passport_number.setText(data['passport_number'])
            self.address.setText(data['address'])
            self.company.setText(data['company'])
            self.position.setText(data['position'])
            self.start_date.setDate(QDate(data['start_date'].year, data['start_date'].month, data['start_date'].day))

        layout.addRow("ФИО:", self.full_name)
        layout.addRow("Серия паспорта:", self.passport_series)
        layout.addRow("Номер паспорта:", self.passport_number)
        layout.addRow("Адрес:", self.address)
        layout.addRow("Компания:", self.company)
        layout.addRow("Должность:", self.position)
        layout.addRow("Дата начала:", self.start_date)

        self.buttons = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        self.buttons.accepted.connect(self.accept)
        self.buttons.rejected.connect(self.reject)
        layout.addRow(self.buttons)

        self.setLayout(layout)

    def get_data(self):
        return {
            'full_name': self.full_name.text(),
            'passport_series': self.passport_series.text(),
            'passport_number': self.passport_number.text(),
            'address': self.address.text(),
            'company': self.company.text(),
            'position': self.position.text(),
            'start_date': self.start_date.date().toPython()
        }

# Окно сотрудников
class EmployeeWindow(QWidget):
    def __init__(self, role):
        super().__init__()
        self.role = role
        self.setWindowTitle("Сотрудники фирмы")
        self.layout = QVBoxLayout()

        search_layout = QHBoxLayout()
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Поиск по имени...")
        self.search_input.textChanged.connect(self.load_data)
        self.filter_company = QComboBox()
        self.filter_company.currentTextChanged.connect(self.load_data)
        search_layout.addWidget(self.search_input)
        search_layout.addWidget(self.filter_company)
        self.layout.addLayout(search_layout)

        self.table = QTableWidget()
        self.table.setColumnCount(7)
        self.table.setHorizontalHeaderLabels([
            "ФИО", "Серия", "Номер", "Адрес", "Компания", "Должность", "Дата начала"
        ])
        self.layout.addWidget(self.table)

        if self.role in ('Администратор', 'Менеджер'):
            add_btn = QPushButton("Добавить сотрудника")
            add_btn.clicked.connect(self.add_employee)
            self.layout.addWidget(add_btn)

        if self.role == 'Администратор':
            edit_btn = QPushButton("Редактировать")
            edit_btn.clicked.connect(self.edit_employee)
            delete_btn = QPushButton("Удалить")
            delete_btn.clicked.connect(self.delete_employee)
            self.layout.addWidget(edit_btn)
            self.layout.addWidget(delete_btn)

        self.setLayout(self.layout)
        self.load_companies()
        self.load_data()

    def load_companies(self):
        session = Session()
        self.filter_company.clear()
        self.filter_company.addItem("Все компании")
        try:
            companies = session.query(Company).order_by(Company.name).all()
            for c in companies:
                self.filter_company.addItem(c.name)
        finally:
            session.close()

    def load_data(self):
        session = Session()
        self.table.setRowCount(0)
        try:
            query = session.query(Position).join(Person).join(Company)
            if name := self.search_input.text().strip().lower():
                query = query.filter(Person.full_name.ilike(f"%{name}%"))
            company = self.filter_company.currentText()
            if company != "Все компании":
                query = query.filter(Company.name == company)

            positions = query.all()
            self.table.setRowCount(len(positions))
            for i, pos in enumerate(positions):
                p = pos.person
                c = pos.company
                values = [
                    p.full_name, p.passport_series, p.passport_number,
                    p.address, c.name, pos.title, pos.start_date.strftime("%Y-%m-%d")
                ]
                for j, val in enumerate(values):
                    self.table.setItem(i, j, QTableWidgetItem(str(val)))
        finally:
            session.close()

    def add_employee(self):
        dialog = EmployeeDialog()
        if dialog.exec() == QDialog.Accepted:
            data = dialog.get_data()
            session = Session()
            try:
                person = Person(
                    full_name=data['full_name'],
                    passport_series=data['passport_series'],
                    passport_number=data['passport_number'],
                    address=data['address']
                )
                company = session.query(Company).filter_by(name=data['company']).first()
                if not company:
                    company = Company(name=data['company'])
                position = Position(
                    title=data['position'],
                    start_date=data['start_date'],
                    person=person,
                    company=company
                )
                session.add_all([person, company, position])
                session.commit()
                self.load_companies()
                self.load_data()
            finally:
                session.close()

    def get_selected_data(self):
        row = self.table.currentRow()
        if row == -1:
            QMessageBox.warning(self, "Ошибка", "Выберите сотрудника.")
            return None
        return [self.table.item(row, i).text() for i in range(7)]

    def edit_employee(self):
        old = self.get_selected_data()
        if not old:
            return
        data_dict = {
            'full_name': old[0], 'passport_series': old[1], 'passport_number': old[2],
            'address': old[3], 'company': old[4], 'position': old[5],
            'start_date': datetime.strptime(old[6], "%Y-%m-%d").date()
        }
        dialog = EmployeeDialog(data_dict)
        if dialog.exec() == QDialog.Accepted:
            new = dialog.get_data()
            session = Session()
            try:
                person = session.query(Person).filter_by(
                    full_name=old[0],
                    passport_series=old[1],
                    passport_number=old[2]
                ).first()
                if not person:
                    return
                person.full_name = new['full_name']
                person.passport_series = new['passport_series']
                person.passport_number = new['passport_number']
                person.address = new['address']

                position = person.positions[0]
                position.title = new['position']
                position.start_date = new['start_date']

                company = session.query(Company).filter_by(name=new['company']).first()
                if not company:
                    company = Company(name=new['company'])
                    session.add(company)
                position.company = company

                session.commit()
                self.load_companies()
                self.load_data()
            finally:
                session.close()

    def delete_employee(self):
        data = self.get_selected_data()
        if not data:
            return
        reply = QMessageBox.question(self, "Удалить", f"Удалить сотрудника {data[0]}?", QMessageBox.Yes | QMessageBox.No)
        if reply == QMessageBox.Yes:
            session = Session()
            try:
                person = session.query(Person).filter_by(
                    full_name=data[0],
                    passport_series=data[1],
                    passport_number=data[2]
                ).first()
                if person:
                    session.delete(person)
                    session.commit()
                    self.load_data()
                    self.load_companies()
            finally:
                session.close()

# Главное окно
class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowIcon(QIcon('./loho.jpg'))
        self.setWindowTitle("Главное меню")
        layout = QVBoxLayout()
        label = QLabel("Выберите роль:")
        layout.addWidget(label)

        for role in ("Администратор", "Менеджер"):
            btn = QPushButton(role)
            btn.clicked.connect(lambda _, r=role: self.open_role_window(r))
            layout.addWidget(btn)

        container = QWidget()
        container.setLayout(layout)
        self.setCentralWidget(container)

    def open_role_window(self, role):
        self.emp_win = EmployeeWindow(role)
        self.emp_win.show()
        self.hide()

# Точка входа
if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
`;
async function getResponse(text) {
  try {
    let hello = await fetch("https://ai.webhunt.ru/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          text +
          ": стек технологий: PySide6, SQLAlchemy, Postgresql, все напиши в одном файле, разработай интерфейс и разработай 3 таблицы, чтобы связи были многие ко многим,ответь на русском",
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
  const start = vscode.commands.registerCommand(
    "extension.startWriting",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || isWriting) return;

      isWriting = true;
      generateText(editor, templateText);
    }
  );

  const stop = vscode.commands.registerCommand("extension.stopWriting", () => {
    isWriting = false;
    clearTimeout(timer);
  });
  const reset = vscode.commands.registerCommand(
    "extension.resetWriting",
    () => {
      isWriting = false;
      clearTimeout(timer);
      currentIndex = 0; // важно!
      vscode.window.showInformationMessage("Сброс выполнен.");
    }
  );

  context.subscriptions.push(start, stop, reset);
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.template", function () {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        editor
          .edit((editBuilder) => {
            // Вставляем текст в курсор (или заменяем выделенный текст)
            editBuilder.insert(editor.selection.start, templateText);
          })
          .then(() => {
            vscode.window.showInformationMessage("Шаблон вставлен!");
          })
          .catch((err) => {
            vscode.window.showErrorMessage("Ошибка при вставке шаблона");
          });
      } else {
        vscode.window.showErrorMessage(
          "Нет открытого документа для вставки шаблона"
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("igorsexy.helloWorld", () => {
      if (activePanel) {
        activePanel.reveal(vscode.ViewColumn.One); 
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

          if (activePanel) {
            activePanel.webview.postMessage({ text: response.text });
          } else {
            messageQueue.push({ text: response.text });
          }
        });
      }
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.write", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const generateText = (text, i = 0) => {
        if (i < text.length) {
          const delay = 10; // Устанавливаем фиксированную задержку

          setTimeout(() => {
            // Позиция курсора
            const position = editor.selection.end; // Берем текущую позицию курсора

            // Вставляем символ в нужное место
            editor
              .edit((editBuilder) => {
                editBuilder.insert(position, text[i]);
              })
              .then(() => {
                generateText(text, i + 1); // Рекурсивный вызов для следующего символа
              });
          }, delay);
        }
      };

      generateText(templateText); // Запускаем генерацию текста
    })
  );

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

function deactivate() {
  isWriting = false;
  clearTimeout(timer);
}

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
