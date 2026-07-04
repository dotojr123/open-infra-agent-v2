import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class EventBus {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(EventBus.name);

  emit(event: string, payload: any): void {
    this.logger.debug(
      `Event emitted: ${event} with payload ${JSON.stringify(payload)}`,
    );
    this.emitter.emit(event, payload);
  }

  on(event: string, handler: (payload: any) => void): void {
    this.emitter.on(event, handler);
  }
}
