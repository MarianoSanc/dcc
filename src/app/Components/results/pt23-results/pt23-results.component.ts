import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface NivelTensionData {
  nivel: number | null;
  dut: (number | null)[];
  patron: (number | null)[];
}

@Component({
  selector: 'app-pt23-results',
  standalone: true,
  imports: [CommonModule, FormsModule], // Only CommonModule and FormsModule here
  templateUrl: './pt23-results.component.html',
  styleUrls: ['./pt23-results.component.css'],
})
export class Pt23ResultsComponent {
  filas = Array(10).fill(0);
  tablas: NivelTensionData[] = [
    { nivel: null, dut: Array(10).fill(null), patron: Array(10).fill(null) },
  ];

  agregarNivel() {
    this.tablas.push({
      nivel: null,
      dut: Array(10).fill(null),
      patron: Array(10).fill(null),
    });
  }

  cerrarTablas() {
    alert('Cierre de bloque (implementar lógica según necesidad)');
  }

  getAverage(arr: (number | null)[]): string {
    const nums = arr
      .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
      .map(Number) as number[];
    if (nums.length === 0) return '';
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return avg.toFixed(3);
  }
}
