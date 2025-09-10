import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DccComponent } from './dcc.component';

describe('DccComponent', () => {
  let component: DccComponent;
  let fixture: ComponentFixture<DccComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DccComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DccComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
