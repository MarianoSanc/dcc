import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DccDataService } from '../../services/dcc-data.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-statements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './statements.component.html',
  styleUrl: './statements.component.css',
})
export class StatementsComponent implements OnInit, OnDestroy {
  statements: any[] = [];
  editingStatements: Set<string> = new Set();
  private subscription = new Subscription();
  database: string = 'calibraciones'; // Ajusta según tu entorno

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    this.loadStatementsFromDatabase(this.database);
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        this.statements = data.statements ? [...data.statements] : [];
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  loadStatementsFromDatabase(database: string) {
    this.dccDataService
      .getAllStatementsFromDatabase(database)
      .subscribe((statements) => {
        this.statements = statements.map((stmt: any) => ({
          ...stmt,
          valid: stmt.valid === 1 ? 1 : null,
          traceable: stmt.traceable === true || stmt.traceable === 'true',
        }));
        this.dccDataService.updateStatements(this.statements);
      });
  }

  editStatement(statementId: string) {
    this.editingStatements.add(statementId);
  }

  saveStatement(statement: any) {
    console.log('Editando statement en base de datos:', statement);
    this.dccDataService
      .updateStatementInDatabase(this.database, statement)
      .subscribe(() => {
        this.editingStatements.delete(statement.id);
        // Recarga los statements para reflejar los cambios
        this.loadStatementsFromDatabase(this.database);
      });
  }

  cancelEdit(statementId: string) {
    // Recarga los datos desde la base de datos para descartar cambios locales
    this.loadStatementsFromDatabase(this.database);
    this.editingStatements.delete(statementId);
  }

  isEditing(statementId: string): boolean {
    return this.editingStatements.has(statementId);
  }
}
