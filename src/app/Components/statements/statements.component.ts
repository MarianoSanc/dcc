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
  editingStatement: string | null = null;
  private subscription: Subscription = new Subscription();

  constructor(private dccDataService: DccDataService) {}

  ngOnInit() {
    this.subscription.add(
      this.dccDataService.dccData$.subscribe((data) => {
        this.statements = data.statements ? [...data.statements] : [];
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  addStatement() {
    const newStatement = {
      id: this.generateId(),
      refType: '',
      norm: '',
      reference: '',
      content: '',
    };
    this.statements.push(newStatement);
    this.editingStatement = newStatement.id;
  }

  editStatement(statementId: string) {
    this.editingStatement = statementId;
  }

  saveStatement(statementId: string) {
    this.editingStatement = null;
    this.dccDataService.updateStatements(this.statements);
    console.log('Statement saved');
  }

  cancelEdit(statementId: string) {
    if (
      this.statements.find(
        (stmt) => stmt.id === statementId && !stmt.refType && !stmt.norm
      )
    ) {
      // Remove statement if it's new and empty
      this.removeStatement(statementId);
    } else {
      // Reload data from service
      const currentData = this.dccDataService.getCurrentData();
      this.statements = currentData.statements
        ? [...currentData.statements]
        : [];
    }
    this.editingStatement = null;
  }

  removeStatement(statementId: string) {
    this.statements = this.statements.filter((stmt) => stmt.id !== statementId);
    this.dccDataService.updateStatements(this.statements);
  }

  isEditing(statementId: string): boolean {
    return this.editingStatement === statementId;
  }

  private generateId(): string {
    return 'stmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
