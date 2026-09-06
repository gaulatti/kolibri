import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { DashboardService } from './dashboard.service';
import type { DashboardReport } from './dashboard.types';

@Controller('v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  report(@CurrentUser() user: AuthenticatedUser): Promise<DashboardReport> {
    return this.dashboard.report(user);
  }
}
