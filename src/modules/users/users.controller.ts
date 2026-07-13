import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../../common/interfaces/request-user.interface';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUserDto } from './dto/current-user.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '查询当前登录用户' })
  @ApiOkResponse({ type: CurrentUserDto })
  getMe(@CurrentUser() user: RequestUser): Promise<CurrentUserDto> {
    return this.usersService.getCurrentUser(user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '注销当前账号并撤销全部会话' })
  @ApiNoContentResponse()
  async deleteMe(@CurrentUser() user: RequestUser): Promise<void> {
    await this.usersService.deleteCurrentUser(user.id);
  }
}
