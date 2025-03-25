import sys
from typing import List, Tuple

from PySide6.QtWidgets import (QApplication, QWidget, QVBoxLayout,
                               QTableWidget, QTableWidgetItem, QPushButton,
                               QLineEdit, QHBoxLayout, QMessageBox)
from PySide6.QtCore import Qt

from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError

# Database configuration
DATABASE_URL = "postgresql://username:password@host:port/database_name"  # Replace with your actual credentials
engine = create_engine(DATABASE_URL)
Base = declarative_base()

# Define the data model (table)
class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True)
    name = Column(String)
    description = Column(String)

    def __repr__(self):
        return f"<Item(name='{self.name}', description='{self.description}')>"

Base.metadata.create_all(engine)  # Create tables if they don't exist
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class MainWindow(QWidget):
    def __init__(self):
        super().__init__()

        self.setWindowTitle("Database Viewer")

        # UI elements
        self.name_input = QLineEdit()
        self.description_input = QLineEdit()
        self.add_button = QPushButton("Add Item")
        self.table = QTableWidget()

        # Layout
        input_layout = QHBoxLayout()
        input_layout.addWidget(self.name_input)
        input_layout.addWidget(self.description_input)
        input_layout.addWidget(self.add_button)

        main_layout = QVBoxLayout()
        main_layout.addLayout(input_layout)
        main_layout.addWidget(self.table)

        self.setLayout(main_layout)

        # Connections
        self.add_button.clicked.connect(self.add_item)

        # Initial load of data
        self.load_data()

    def load_data(self):
        """Loads data from the database and displays it in the table."""
        try:
            db = SessionLocal()
            items = db.query(Item).all()
            db.close()  # Important to close the session!

            self.table.setRowCount(0)  # Clear existing data
            self.table.setColumnCount(3)
            self.table.setHorizontalHeaderLabels(["ID", "Name", "Description"])

            for row, item in enumerate(items):
                self.table.insertRow(row)
                self.table.setItem(row, 0, QTableWidgetItem(str(item.id)))
                self.table.setItem(row, 1, QTableWidgetItem(item.name))
                self.table.setItem(row, 2, QTableWidgetItem(item.description))

        except SQLAlchemyError as e:
            self.show_error_message(f"Error loading data from database: {e}")

    def add_item(self):
        """Adds a new item to the database and refreshes the table."""
        name = self.name_input.text()
        description = self.description_input.text()

        if not name or not description:
            self.show_error_message("Name and Description cannot be empty.")
            return

        try:
            db = SessionLocal()
            new_item = Item(name=name, description=description)
            db.add(new_item)
            db.commit()
            db.refresh(new_item)  # Refresh to get the generated ID
            db.close()

            self.name_input.clear()
            self.description_input.clear()
            self.load_data()  # Refresh the table

            self.show_success_message("Item added successfully!")

        except SQLAlchemyError as e:
            db.rollback()  # Rollback changes in case of error
            db.close()
            self.show_error_message(f"Error adding item to database: {e}")


    def show_error_message(self, message: str):
        """Displays an error message dialog."""
        msg = QMessageBox()
        msg.setIcon(QMessageBox.Critical)
        msg.setText("Error")
        msg.setInformativeText(message)
        msg.setWindowTitle("Error")
        msg.exec()

    def show_success_message(self, message: str):
        """Displays a success message dialog."""
        msg = QMessageBox()
        msg.setIcon(QMessageBox.Information)
        msg.setText("Success")
        msg.setInformativeText(message)
        msg.setWindowTitle("Success")
        msg.exec()


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())