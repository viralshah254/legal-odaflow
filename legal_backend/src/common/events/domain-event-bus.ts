/**
 * DomainEventBus – lightweight injectable wrapper over Node's EventEmitter.
 *
 * If the project adds @nestjs/event-emitter in the future, replace this class
 * with EventEmitter2 and update outbox.service.ts / outbox-publisher.scheduler.ts.
 */
import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DomainEvent } from './domain-event.types';

@Injectable()
export class DomainEventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit(event: DomainEvent): void {
    this.emitter.emit(event.type, event);
    // Also emit a wildcard so catch-all listeners can subscribe to '*'
    this.emitter.emit('*', event);
  }

  on(eventType: string, listener: (event: DomainEvent) => void): void {
    this.emitter.on(eventType, listener);
  }

  off(eventType: string, listener: (event: DomainEvent) => void): void {
    this.emitter.off(eventType, listener);
  }

  once(eventType: string, listener: (event: DomainEvent) => void): void {
    this.emitter.once(eventType, listener);
  }
}
