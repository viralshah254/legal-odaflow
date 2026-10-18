import { validate } from 'class-validator';
import { CreateMatterDto } from './dto/create-matter.dto';

describe('matter integrity foundation', () => {
  it('requires a non-empty clientId when creating a matter', async () => {
    const dto = Object.assign(new CreateMatterDto(), {
      title: 'Contract dispute',
      countryCode: 'IN',
      practiceArea: 'Commercial',
      matterType: 'Litigation',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'clientId')).toBe(true);
  });
});
