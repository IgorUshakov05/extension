import sys
from PySide6.QtWidgets import (QApplication, QMainWindow, QPushButton, QVBoxLayout, QWidget,
                                 QLabel, QLineEdit, QTableWidget, QTableWidgetItem, QComboBox,
                                 QMessageBox, QHBoxLayout, QDialog, QFormLayout, QDialogButtonBox, QDateEdit)
from PySide6.QtGui import QIcon
from PySide6.QtCore import Qt, QDate
from sqlalchemy import create_engine, Column, Integer, String, Date, select, distinct
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

# Настройки подключения к БД
DB_URI = 'postgresql+psycopg2://postgres:21730Igor@localhost:5432/database'
engine = create_engine(DB_URI)
Session = sessionmaker(bind=engine)
Base = declarative_base()

class Employee(Base):
    __tablename__ = 'employees'

    id = Column(Integer, primary_key=True)
    full_name = Column(String)
    passport_series = Column(String)
    passport_number = Column(String)
    address = Column(String)
    company = Column(String)
    position = Column(String)
    start_date = Column(Date)

Base.metadata.create_all(engine)

class EmployeeDialog(QDialog):
    def __init__(self, data=None):
        super().__init__()
        self.setWindowTitle("Форма сотрудника")
        self.setWindowIcon(QIcon('image.png'))

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
            self.full_name.setText(data.full_name)
            self.passport_series.setText(data.passport_series)
            self.passport_number.setText(data.passport_number)
            self.address.setText(data.address)
            self.company.setText(data.company)
            self.position.setText(data.position)
            self.start_date.setDate(QDate(data.start_date.year, data.start_date.month, data.start_date.day))

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
        return Employee(
            full_name=self.full_name.text(),
            passport_series=self.passport_series.text(),
            passport_number=self.passport_number.text(),
            address=self.address.text(),
            company=self.company.text(),
            position=self.position.text(),
            start_date=self.start_date.date().toPython()
        )

class EmployeeWindow(QWidget):
    def __init__(self, role):
        super().__init__()
        self.role = role
        self.setWindowTitle("Сотрудники фирмы")
        self.setWindowIcon(QIcon(':/icons/logo.png'))

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
            "ФИО", "Серия паспорта", "Номер паспорта", "Адрес", "Компания", "Должность", "Дата начала"
        ])
        self.layout.addWidget(self.table)

        if self.role in ('Администратор', 'Менеджер'):
            self.add_btn = QPushButton("Добавить сотрудника")
            self.add_btn.clicked.connect(self.add_employee)
            self.layout.addWidget(self.add_btn)

        if self.role == 'Администратор':
            self.edit_btn = QPushButton("Редактировать выбранного сотрудника")
            self.edit_btn.clicked.connect(self.edit_employee)
            self.layout.addWidget(self.edit_btn)

            self.delete_btn = QPushButton("Удалить выбранного сотрудника")
            self.delete_btn.clicked.connect(self.delete_employee)
            self.layout.addWidget(self.delete_btn)

        self.setLayout(self.layout)
        self.load_companies()
        self.load_data()

    def load_companies(self):
        session = Session()
        self.filter_company.clear()
        self.filter_company.addItem("Все компании")
        try:
            companies = session.query(distinct(Employee.company)).order_by(Employee.company).all()
            for company, in companies:
                self.filter_company.addItem(company)
        finally:
            session.close()

    def load_data(self):
        session = Session()
        try:
            query = session.query(Employee)
            name_filter = self.search_input.text().strip().lower()
            if name_filter:
                query = query.filter(Employee.full_name.ilike(f"%{name_filter}%"))

            company = self.filter_company.currentText()
            if company != "Все компании":
                query = query.filter(Employee.company == company)

            rows = query.all()
            self.table.setRowCount(len(rows))
            for row_idx, emp in enumerate(rows):
                values = [emp.full_name, emp.passport_series, emp.passport_number, emp.address, emp.company, emp.position, emp.start_date.strftime("%Y-%m-%d")]
                for col_idx, value in enumerate(values):
                    self.table.setItem(row_idx, col_idx, QTableWidgetItem(str(value)))
        finally:
            session.close()

    def add_employee(self):
        dialog = EmployeeDialog()
        if dialog.exec() == QDialog.Accepted:
            emp = dialog.get_data()
            session = Session()
            try:
                session.add(emp)
                session.commit()
                self.load_data()
            finally:
                session.close()

    def edit_employee(self):
        selected = self.table.currentRow()
        if selected == -1:
            QMessageBox.warning(self, "Редактирование", "Выберите сотрудника для редактирования.")
            return

        session = Session()
        try:
            full_name = self.table.item(selected, 0).text()
            passport_series = self.table.item(selected, 1).text()
            passport_number = self.table.item(selected, 2).text()
            emp = session.query(Employee).filter_by(
                full_name=full_name, passport_series=passport_series, passport_number=passport_number
            ).first()
            if not emp:
                QMessageBox.warning(self, "Ошибка", "Сотрудник не найден.")
                return

            dialog = EmployeeDialog(emp)
            if dialog.exec() == QDialog.Accepted:
                new_emp = dialog.get_data()
                emp.full_name = new_emp.full_name
                emp.passport_series = new_emp.passport_series
                emp.passport_number = new_emp.passport_number
                emp.address = new_emp.address
                emp.company = new_emp.company
                emp.position = new_emp.position
                emp.start_date = new_emp.start_date
                session.commit()
                self.load_data()
        finally:
            session.close()

    def delete_employee(self):
        selected = self.table.currentRow()
        if selected == -1:
            QMessageBox.warning(self, "Удаление", "Выберите сотрудника для удаления.")
            return

        full_name = self.table.item(selected, 0).text()
        passport_series = self.table.item(selected, 1).text()
        passport_number = self.table.item(selected, 2).text()
        reply = QMessageBox.question(self, "Подтверждение", f"Удалить сотрудника {full_name}?", QMessageBox.Yes | QMessageBox.No)
        if reply == QMessageBox.Yes:
            session = Session()
            try:
                emp = session.query(Employee).filter_by(
                    full_name=full_name, passport_series=passport_series, passport_number=passport_number
                ).first()
                if emp:
                    session.delete(emp)
                    session.commit()
                    self.load_data()
            finally:
                session.close()

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Главное меню")
        self.setWindowIcon(QIcon(':/icons/logo.png'))

        self.layout = QVBoxLayout()
        self.label = QLabel("Выберите роль:")
        self.layout.addWidget(self.label)

        self.admin_btn = QPushButton("Администратор")
        self.manager_btn = QPushButton("Менеджер")

        self.admin_btn.clicked.connect(lambda: self.open_role_window('Администратор'))
        self.manager_btn.clicked.connect(lambda: self.open_role_window('Менеджер'))

        self.layout.addWidget(self.admin_btn)
        self.layout.addWidget(self.manager_btn)

        container = QWidget()
        container.setLayout(self.layout)
        self.setCentralWidget(container)

    def open_role_window(self, role):
        self.employee_window = EmployeeWindow(role)
        self.employee_window.show()
        self.hide()

if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())