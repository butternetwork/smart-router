import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { RouterService } from './service';

@Controller('router')
export class RouterController {
  constructor(private readonly routerService: RouterService) {}

  @Get('best_route')
  async getBestRoute(
    @Query('fromChainId') fromChainId: string,
    @Query('toChainId') toChainId: string,
    @Query('amountIn') amountIn: string,
    @Query('tokenInAddress') tokenInAddress: string,
    @Query('tokenInDecimal') tokenInDecimal: number,
    @Query('tokenInSymbol') tokenInSymbol: string,
    @Query('tokenOutAddress') tokenOutAddress: string,
    @Query('tokenOutDecimal') tokenOutDecimal: number,
    @Query('tokenOutSymbol') tokenOutSymbol: string
  ): Promise<any> {
    try {
      const bestRouter = await this.routerService.crossChainRouter(
        tokenInAddress,
        tokenInDecimal,
        tokenInSymbol,
        tokenOutAddress,
        tokenOutDecimal,
        tokenOutSymbol,
        amountIn,
        fromChainId,
        toChainId
      );
      return bestRouter;
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      } else if (error instanceof Error) {
        throw new HttpException(
          error.message,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      } else {
        throw new HttpException(
          'unknown error',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }
}
