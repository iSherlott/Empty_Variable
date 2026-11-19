import { DatePipe } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { mensagemDeErro } from "../core/modelos";

interface Vaga {
  tipo: "OBRIGATORIA" | "SECUNDARIA" | "LIVRE";
  classeId: string | null;
  classe: string | null;
  importancia: number | null;
  ocupada: boolean;
  meuPersonagem: string | null;
}
interface Grupo {
  id: string;
  instancia: { nome: string };
  agendadoEm: string;
  fechadoEm: string | null;
  vagas: Vaga[];
}
interface Dados {
  grupos: Grupo[];
  personagens: { id: string; nome: string; classeId: string | null }[];
}

@Component({
  selector: "app-instancias-programadas",
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <section class="pagina">
      <header><h1>Instâncias programadas</h1></header>
      @if (erro(); as mensagem) {
        <p role="alert">{{ mensagem }}</p>
      }
      @if (confirmacao(); as mensagem) {
        <p role="status">{{ mensagem }}</p>
      }
      @if (carregando()) {
        <p role="status">Carregando instâncias…</p>
      } @else {
        @if (dados().grupos.length && !dados().personagens.length) {
          <p><a routerLink="/vinculo">Vincule um personagem</a> para participar.</p>
        }
        <div class="agenda">
          @for (grupo of dados().grupos; track grupo.id) {
            <article>
              <header>
                <h2>{{ grupo.instancia.nome }}</h2>
                <span>{{ grupo.agendadoEm | date: "dd/MM/yyyy 'às' HH:mm" : "-0300" }} · São Paulo</span>
              </header>
              <p>{{ totalOcupadas(grupo) }}/12 preenchidas · {{ grupo.fechadoEm ? "Fechado" : "Aberto" }}</p>
              <button
                class="botao-acao"
                type="button"
                (click)="ver(grupo.id)"
                [attr.aria-expanded]="aberto() === grupo.id"
              >
                {{ aberto() === grupo.id ? "Recolher vagas" : "Ver vagas" }}
              </button>
              @if (aberto() === grupo.id) {
                <ul class="vagas" aria-label="Vagas do grupo">
                  @for (vaga of grupo.vagas; track $index; let i = $index) {
                    @let meus = elegiveis(vaga);
                    <li>
                      <div>
                        <strong>Vaga {{ i + 1 }} · {{ rotulos[vaga.tipo] }}</strong>
                        <small
                          >{{ vaga.classe ?? "Qualquer classe" }}
                          @if (vaga.importancia !== null) {
                            · Importância {{ vaga.importancia }}
                          }
                        </small>
                      </div>
                      @if (vaga.meuPersonagem) {
                        <span class="confirmado">Você · {{ vaga.meuPersonagem }}</span>
                      } @else if (vaga.ocupada) {
                        <span>Ocupada</span>
                      } @else if (grupo.fechadoEm || jaParticipa()) {
                        <span>Livre</span>
                      } @else if (meus.length) {
                        @if (vagaAtiva() === i) {
                          <div class="escolha">
                            <label
                              >Personagem
                              <select [(ngModel)]="personagemId">
                                <option value="">Selecione</option>
                                @for (personagem of meus; track personagem.id) {
                                  <option [value]="personagem.id">{{ personagem.nome }}</option>
                                }
                              </select>
                            </label>
                            <button
                              type="button"
                              class="botao-acao"
                              [disabled]="!personagemId || enviando()"
                              (click)="participar(grupo.id, i)"
                            >
                              Confirmar vaga
                            </button>
                          </div>
                        } @else {
                          <button
                            type="button"
                            class="botao-acao"
                            (click)="escolher(i)"
                            [disabled]="enviando()"
                          >
                            Entrar na vaga
                          </button>
                        }
                      } @else {
                        <span>Sem personagem elegível</span>
                      }
                    </li>
                  }
                </ul>
              }
            </article>
          } @empty {
            <p>Nenhuma instância programada.</p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    h1,
    h2 {
      margin: 0;
    }
    h2 {
      font-size: 1.2rem;
    }
    .agenda,
    .vagas {
      display: grid;
      gap: 10px;
      margin-block: 12px;
    }
    article {
      padding: 16px;
      background: var(--superficie);
      border: 1px solid var(--borda);
      border-radius: 12px;
    }
    article header span,
    small {
      color: var(--texto-suave);
    }
    .vagas {
      list-style: none;
      padding: 0;
    }
    .vagas li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      background: var(--cartao);
      border: 1px solid var(--borda);
      border-radius: 8px;
      padding: 9px 12px;
    }
    small {
      display: block;
      margin-top: 4px;
    }
    .escolha {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: end;
      min-width: 0;
    }
    .escolha label {
      display: grid;
      gap: 4px;
      min-width: 0;
    }
    select {
      box-sizing: border-box;
      max-width: 100%;
      color: var(--texto);
      background: var(--fundo);
      padding: 7px;
      border: 1px solid var(--borda-forte);
      border-radius: 6px;
    }
    .confirmado {
      color: var(--acento-forte);
    }
  `,
})
export class InstanciasProgramadasComponent {
  private readonly http = inject(HttpClient);
  private readonly url = "/api/instancias-programadas";
  readonly dados = signal<Dados>({ grupos: [], personagens: [] });
  readonly aberto = signal<string | null>(null);
  readonly vagaAtiva = signal<number | null>(null);
  readonly erro = signal<string | null>(null);
  readonly confirmacao = signal<string | null>(null);
  readonly carregando = signal(true);
  readonly enviando = signal(false);
  readonly jaParticipa = computed(
    () =>
      !!this.dados()
        .grupos.find((grupo) => grupo.id === this.aberto())
        ?.vagas.some((vaga) => vaga.meuPersonagem),
  );
  readonly rotulos: Record<Vaga["tipo"], string> = {
    OBRIGATORIA: "Obrigatória",
    SECUNDARIA: "Secundária",
    LIVRE: "Livre",
  };
  personagemId = "";

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      this.dados.set(await firstValueFrom(this.http.get<Dados>(this.url)));
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      this.carregando.set(false);
    }
  }

  totalOcupadas(grupo: Grupo): number {
    return grupo.vagas.filter((vaga) => vaga.ocupada).length;
  }

  elegiveis(vaga: Vaga) {
    return this.dados().personagens.filter((char) => !vaga.classeId || vaga.classeId === char.classeId);
  }

  ver(id: string): void {
    if (this.enviando()) return;
    this.aberto.set(this.aberto() === id ? null : id);
    this.vagaAtiva.set(null);
  }

  escolher(i: number): void {
    this.personagemId = "";
    this.vagaAtiva.set(i);
  }

  async participar(grupoId: string, indice: number): Promise<void> {
    if (!this.personagemId || this.enviando()) return;
    this.erro.set(null);
    this.confirmacao.set(null);
    this.enviando.set(true);
    try {
      await firstValueFrom(
        this.http.post(this.url + "/" + grupoId + "/participar", {
          personagemId: this.personagemId,
          vaga: indice + 1,
        }),
      );
      this.confirmacao.set("Vaga confirmada.");
      this.vagaAtiva.set(null);
    } catch (e) {
      this.erro.set(mensagemDeErro(e));
    } finally {
      await this.carregar();
      this.enviando.set(false);
    }
  }
}
