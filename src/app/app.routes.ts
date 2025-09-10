import { Routes } from '@angular/router';
import { HomeComponent } from './Components/home/home.component';
import { DccComponent } from './Components/dcc/dcc.component';

export const routes: Routes = [
  { path: '', component: DccComponent },
  { path: 'view', component: DccComponent },
];
