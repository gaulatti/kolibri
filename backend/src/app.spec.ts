import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('application root', () => {
  it('delegates the root response to the application service', () => {
    const service = new AppService();
    expect(new AppController(service).getHello()).toBe('Hello World!');
  });
});
