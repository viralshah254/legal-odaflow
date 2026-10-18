import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  PersonalVaultService,
  VaultDocument,
  VaultContact,
  VaultLifeEvent,
} from './personal-vault.service';

@Controller('vault')
export class PersonalVaultController {
  constructor(private readonly svc: PersonalVaultService) {}

  @Get(':userId')
  getVault(@Param('userId') userId: string) {
    return this.svc.getVault(userId);
  }

  @Post(':userId/documents')
  addDocument(
    @Param('userId') userId: string,
    @Body() doc: Omit<VaultDocument, 'id' | 'addedAt'>,
  ) {
    return this.svc.addDocument(userId, doc);
  }

  @Delete(':userId/documents/:docId')
  @HttpCode(HttpStatus.OK)
  removeDocument(
    @Param('userId') userId: string,
    @Param('docId') docId: string,
  ) {
    return this.svc.removeDocument(userId, docId);
  }

  @Post(':userId/contacts')
  addContact(
    @Param('userId') userId: string,
    @Body() contact: Omit<VaultContact, 'id' | 'addedAt'>,
  ) {
    return this.svc.addContact(userId, contact);
  }

  @Post(':userId/events')
  addLifeEvent(
    @Param('userId') userId: string,
    @Body() event: Omit<VaultLifeEvent, 'id' | 'addedAt'>,
  ) {
    return this.svc.addLifeEvent(userId, event);
  }
}
