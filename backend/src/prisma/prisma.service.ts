import { Global, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/** Cliente de transação do Prisma (o `tx` de `$transaction`). */
export type Tx = Parameters<Parameters<PrismaService["$transaction"]>[0]>[0];

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
