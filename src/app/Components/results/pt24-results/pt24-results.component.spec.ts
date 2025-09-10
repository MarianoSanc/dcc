import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pt24ResultsComponent } from './pt24-results.component';

describe('Pt24ResultsComponent', () => {
  let component: Pt24ResultsComponent;
  let fixture: ComponentFixture<Pt24ResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pt24ResultsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Pt24ResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
