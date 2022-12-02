import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { RouteWithValidQuote } from '../routers';
import { RouterService } from './service';

@Controller('router')
export class RouterController {
  constructor(private readonly routerService: RouterService) { }

  @Get('best_route')
  async getBestRoute(
    @Query('chainId') chainId: number,
    @Query('amountIn') amountIn: string,
    @Query('tokenInAddress') tokenInAddress: string,
    @Query('tokenInDecimal') tokenInDecimal: string,
    @Query('tokenOutAddress') tokenOutAddress: string,
    @Query('tokenOutDecimal') tokenOutDecimal: string,
  ): Promise<RouteWithValidQuote[]> {
    try {
      let res: RouteWithValidQuote[]
      if (chainId != 1313161554) {
        res = await this.routerService.getBestRoute(
          chainId,
          amountIn,
          tokenInAddress,
          Number.parseInt(tokenInDecimal),
          tokenOutAddress,
          Number.parseInt(tokenOutDecimal),
        );
      } else {
        res = await this.routerService.getRefRoute(
          amountIn,
          tokenInAddress,
          tokenOutAddress,
        );
      }
      return res
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw new HttpException(
          error.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        throw new HttpException(
          'unknown error',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }
}