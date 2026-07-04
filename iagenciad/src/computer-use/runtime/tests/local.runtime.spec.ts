/* eslint-disable */
import { Test } from '@nestjs/testing';
import { LocalRuntime } from '../plugins/local.runtime';
import { NutService } from '../../../nut/nut.service';

describe('LocalRuntime', () => {
  let localRuntime: LocalRuntime;
  let nutService: NutService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        LocalRuntime,
        {
          provide: NutService,
          useValue: {
            mouseMoveEvent: jest.fn().mockResolvedValue(undefined),
            screendump: jest.fn().mockResolvedValue(Buffer.from('dummy')),
          },
        },
      ],
    }).compile();

    localRuntime = moduleRef.get<LocalRuntime>(LocalRuntime);
    nutService = moduleRef.get<NutService>(NutService);
  });

  it('should be defined', () => {
    expect(localRuntime).toBeDefined();
  });

  it('should move mouse via input controller', async () => {
    const action = {
      action: 'move_mouse' as const,
      coordinates: { x: 50, y: 80 },
    };
    await localRuntime.getInputController().moveMouse(action);
    expect(nutService.mouseMoveEvent).toHaveBeenCalledWith({ x: 50, y: 80 });
  });

  it('should take screenshots via display controller', async () => {
    const res = await localRuntime.getDisplayController().screenshot();
    expect(res.image).toBe(Buffer.from('dummy').toString('base64'));
    expect(nutService.screendump).toHaveBeenCalled();
  });
});
