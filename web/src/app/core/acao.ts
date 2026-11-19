import { inject, Injectable } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { mensagemDeErro } from "./modelos";

/** Executa uma operação de escrita e avisa sucesso ou o erro da API num snackbar. */
@Injectable({ providedIn: "root" })
export class Acao {
  private readonly snack = inject(MatSnackBar);

  avisar(msg: string): void {
    this.snack.open(msg, "OK", { duration: 4000 });
  }

  async executar(op: () => Promise<unknown>, sucesso: string): Promise<boolean> {
    try {
      await op();
      this.avisar(sucesso);
      return true;
    } catch (e) {
      this.avisar(mensagemDeErro(e));
      return false;
    }
  }
}
