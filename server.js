const express = require("express");
const multer = require("multer");
const fs = require("fs");
const xml2js = require("xml2js");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const db = new sqlite3.Database("banco.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS notas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT,
      fornecedor TEXT,
      data TEXT,
      complemento_manual TEXT,
      prioridade TEXT,
      responsavel_atual TEXT,
      valor_frete TEXT,
      volumes TEXT,
      transportadora TEXT,
      cnpj_transportadora TEXT,
      vencimento TEXT,
      valor_boleto TEXT,
      complemento_icms TEXT,
      markup_nota TEXT,
      status TEXT DEFAULT 'Importada'
    )
  `);

  db.run(`ALTER TABLE notas ADD COLUMN complemento_manual TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN prioridade TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN responsavel_atual TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN valor_frete TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN volumes TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN transportadora TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN cnpj_transportadora TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN vencimento TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN valor_boleto TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN complemento_icms TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN markup_nota TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN status TEXT DEFAULT 'Importada'`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN cte TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN observacao_admin TEXT`, () => {});
  db.run(`ALTER TABLE itens_nota ADD COLUMN codigo_loja TEXT`, () => {});
  db.run(`
    CREATE TABLE IF NOT EXISTS itens_nota (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nota_id INTEGER,
      codigo TEXT,
      descricao TEXT,
      quantidade TEXT,
      valor_unitario TEXT,
      valor_total TEXT,
      preco_sugerido TEXT
    )
  `);

  db.run(`ALTER TABLE itens_nota ADD COLUMN preco_sugerido TEXT`, () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT UNIQUE,
      senha_hash TEXT,
      cargo TEXT,
      ativo INTEGER DEFAULT 1,
      criado_em TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comentarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nota_id INTEGER,
      usuario_id INTEGER,
      mensagem TEXT,
      data TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ocorrencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nota_id INTEGER,
      tipo TEXT,
      titulo TEXT,
      mensagem TEXT,
      status TEXT DEFAULT 'Aberta',
      criado_por INTEGER,
      criado_em TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS respostas_ocorrencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ocorrencia_id INTEGER,
      usuario_id INTEGER,
      mensagem TEXT,
      criado_em TEXT
    )
  `);
  db.run(`
  CREATE TABLE IF NOT EXISTS solicitacoes_peca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendedor_id INTEGER,
    nota_id INTEGER,
    item_id INTEGER,
    codigo_loja TEXT,
    descricao TEXT,
    quantidade_solicitada INTEGER,
    status TEXT DEFAULT 'Aberta',
    mensagem TEXT,
    criado_em TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS respostas_solicitacao_peca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    solicitacao_id INTEGER,
    usuario_id INTEGER,
    mensagem TEXT,
    criado_em TEXT
  )
`);
});

async function criarUsuarioPadrao(nome, senha, cargo) {
  const senhaHash = await bcrypt.hash(senha, 10);
  const criadoEm = new Date().toISOString();

  db.run(
    `
    INSERT INTO usuarios (nome, senha_hash, cargo, ativo, criado_em)
    SELECT ?, ?, ?, 1, ?
    WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE nome = ?)
    `,
    [nome, senhaHash, cargo, criadoEm, nome]
  );
}

criarUsuarioPadrao("admin", "123", "admin");
criarUsuarioPadrao("kaique", "123", "administrativo");
criarUsuarioPadrao("estoque", "123", "estoque");
criarUsuarioPadrao("vendedor", "123", "vendedor");

const app = express();

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

app.post("/importar-xml", upload.single("xml"), (req, res) => {
  const caminhoArquivo = req.file.path;

  fs.readFile(caminhoArquivo, "utf-8", (erro, conteudo) => {
    if (erro) {
      return res.send("Erro ao ler o arquivo");
    }

    xml2js.parseString(conteudo, (erro, resultado) => {
      if (erro) {
        return res.send("Erro ao converter XML");
      }

      const nfe = resultado.nfeProc.NFe[0].infNFe[0];

      const numeroNota = nfe.ide?.[0]?.nNF?.[0] || "";
      const dataEmissao = nfe.ide?.[0]?.dhEmi?.[0] || "";
      const fornecedor = nfe.emit?.[0]?.xNome?.[0] || "";

      const frete = nfe.total?.[0]?.ICMSTot?.[0]?.vFrete?.[0] || "";
      const volumes = nfe.transp?.[0]?.vol?.[0]?.qVol?.[0] || "";
      const transportadora = nfe.transp?.[0]?.transporta?.[0]?.xNome?.[0] || "";
      const cnpjTransportadora = nfe.transp?.[0]?.transporta?.[0]?.CNPJ?.[0] || "";
      const vencimento = nfe.cobr?.[0]?.dup?.[0]?.dVenc?.[0] || "";
      const valorBoleto = nfe.cobr?.[0]?.dup?.[0]?.vDup?.[0] || "";
      const complemento = nfe.infAdic?.[0]?.infCpl?.[0] || "";

      db.run(
        `
        INSERT INTO notas (
          numero,
          fornecedor,
          data,
          valor_frete,
          volumes,
          transportadora,
          cnpj_transportadora,
          vencimento,
          valor_boleto,
          complemento_icms,
          markup_nota,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          numeroNota,
          fornecedor,
          dataEmissao,
          frete,
          volumes,
          transportadora,
          cnpjTransportadora,
          vencimento,
          valorBoleto,
          complemento,
          "1.896",
          "Importada"
        ],
        function (erro) {
          if (erro) {
            console.log(erro);
            return res.send("Erro ao salvar nota");
          }

          const notaId = this.lastID;
          const itens = nfe.det || [];

          itens.forEach((item) => {
            const produto = item.prod[0];

            const codigo = produto.cProd?.[0] || "";
            const descricao = produto.xProd?.[0] || "";
            const quantidade = produto.qCom?.[0] || "";
            const valorUnitario = produto.vUnCom?.[0] || "";
            const valorTotal = produto.vProd?.[0] || "";
            const precoSugerido = Number(valorUnitario || 0) * 1.896;

            db.run(
              `
              INSERT INTO itens_nota (
                nota_id,
                codigo,
                descricao,
                quantidade,
                valor_unitario,
                valor_total,
                preco_sugerido
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
              [
                notaId,
                codigo,
                descricao,
                quantidade,
                valorUnitario,
                valorTotal,
                precoSugerido
              ]
            );
          });

          res.send("Nota e itens salvos no banco com sucesso");
        }
      );
    });
  });
});

app.get("/notas", (req, res) => {
  db.all("SELECT * FROM notas ORDER BY id DESC", (erro, linhas) => {
    if (erro) {
      return res.status(500).send("Erro ao buscar notas");
    }

    res.json(linhas);
  });
});

app.get("/nota/:id", (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM notas WHERE id = ?", [id], (erro, nota) => {
    if (erro) {
      return res.status(500).send("Erro ao buscar nota");
    }

    if (!nota) {
      return res.status(404).send("Nota não encontrada");
    }

    res.json(nota);
  });
});

app.get("/nota/:id/itens", (req, res) => {
  const id = req.params.id;

  db.all("SELECT * FROM itens_nota WHERE nota_id = ?", [id], (erro, itens) => {
    if (erro) {
      return res.status(500).send("Erro ao buscar itens");
    }

    res.json(itens);
  });
});

app.get("/usuarios", (req, res) => {
  db.all(
    "SELECT id, nome, cargo, ativo, criado_em FROM usuarios ORDER BY nome ASC",
    (erro, usuarios) => {
      if (erro) {
        return res.status(500).send("Erro ao buscar usuários");
      }

      res.json(usuarios);
    }
  );
});

app.post("/login", (req, res) => {
  const nome = req.body.nome;
  const senha = req.body.senha;

  db.get(
    "SELECT * FROM usuarios WHERE nome = ? AND ativo = 1",
    [nome],
    async (erro, usuario) => {
      if (erro) {
        return res.send("Erro no login");
      }

      if (!usuario) {
        return res.send("Usuário não encontrado");
      }

      const senhaCorreta = await bcrypt.compare(senha, usuario.senha_hash);

      if (!senhaCorreta) {
        return res.send("Senha incorreta");
      }

      res.json({
        id: usuario.id,
        nome: usuario.nome,
        cargo: usuario.cargo
      });
    }
  );
});

app.post("/nota/:id/admin", (req, res) => {
  const id = req.params.id;

  const cte = req.body.cte || "";
  const complementoManual = req.body.complemento_manual || "";
  const observacaoAdmin = req.body.observacao_admin || "";

  db.run(
    `
    UPDATE notas
    SET
      cte = ?,
      complemento_manual = ?,
      observacao_admin = ?
    WHERE id = ?
    `,
    [cte, complementoManual, observacaoAdmin, id],
    function (erro) {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao salvar dados administrativos");
      }

      res.send("Dados administrativos salvos com sucesso");
    }
  );
});

app.post("/nota/:id/status-unico", (req, res) => {
  const id = req.params.id;
  const status = req.body.status;

  const statusValidos = [
    "Importada",
    "Administrativo",
    "Liberada para estoque",
    "Em conferência",
    "Conferir ocorrências",
    "Iury",
    "Lançamento",
    "Marcação",
    "Finalizada"
  ];

  if (!statusValidos.includes(status)) {
    return res.status(400).send("Status inválido");
  }

  db.run(
    `
    UPDATE notas
    SET status = ?
    WHERE id = ?
    `,
    [status, id],
    (erro) => {
      if (erro) {
        return res.status(500).send("Erro ao atualizar status");
      }

      res.send("Status atualizado com sucesso");
    }
  );
});

app.post("/nota/:id/proxima-etapa", (req, res) => {
  const id = req.params.id;

  const fluxo = [
    "Importada",
    "Administrativo",
    "Liberada para estoque",
    "Em conferência",
    "Conferir ocorrências",
    "Iury",
    "Lançamento",
    "Marcação",
    "Finalizada"
  ];

  db.get("SELECT status FROM notas WHERE id = ?", [id], (erro, nota) => {
    if (erro || !nota) {
      return res.status(404).send("Nota não encontrada");
    }

    let statusAtual = nota.status;

    if (!statusAtual || statusAtual.trim() === "") {
      statusAtual = "Importada";
    }

    const indiceAtual = fluxo.indexOf(statusAtual);

    if (indiceAtual === -1) {
      return res.status(400).send("Status inválido: " + statusAtual);
    }

    if (indiceAtual === fluxo.length - 1) {
      return res.send("Nota já finalizada");
    }

    const proximoStatus = fluxo[indiceAtual + 1];

    db.run(
      `
      UPDATE notas
      SET status = ?
      WHERE id = ?
      `,
      [proximoStatus, id],
      function (erro) {
        if (erro) {
          console.log(erro);
          return res.status(500).send("Erro ao avançar etapa");
        }

        res.send("Etapa avançada para: " + proximoStatus);
      }
    );
  });
});

app.post("/nota/:id/markup", (req, res) => {
  const id = req.params.id;
  const markup = String(req.body.markup || "").replace(",", ".");

  if (isNaN(Number(markup)) || Number(markup) <= 0) {
    return res.status(400).send("Markup inválido");
  }

  db.serialize(() => {
    db.run(
      "UPDATE notas SET markup_nota = ? WHERE id = ?",
      [markup, id],
      (erro) => {
        if (erro) {
          return res.status(500).send("Erro ao salvar markup");
        }
      }
    );

    db.run(
      `
      UPDATE itens_nota
      SET preco_sugerido = valor_unitario * ?
      WHERE nota_id = ?
      `,
      [Number(markup), id],
      (erro) => {
        if (erro) {
          console.log(erro);
          return res.status(500).send("Erro ao aplicar markup");
        }

        res.send("Markup aplicado");
      }
    );
  });
});

app.get("/nota/:id/comentarios", (req, res) => {
  const id = req.params.id;

  db.all(
    `
    SELECT
      comentarios.id,
      comentarios.mensagem,
      comentarios.data,
      usuarios.nome,
      usuarios.cargo
    FROM comentarios
    LEFT JOIN usuarios ON usuarios.id = comentarios.usuario_id
    WHERE comentarios.nota_id = ?
    ORDER BY comentarios.id ASC
    `,
    [id],
    (erro, comentarios) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar comentários");
      }

      res.json(comentarios);
    }
  );
});

app.post("/nota/:id/comentarios", (req, res) => {
  const notaId = req.params.id;
  const usuarioId = req.body.usuario_id;
  const mensagem = req.body.mensagem;
  const data = new Date().toISOString();

  if (!mensagem || !mensagem.trim()) {
    return res.status(400).send("Comentário vazio");
  }

  db.run(
    `
    INSERT INTO comentarios (nota_id, usuario_id, mensagem, data)
    VALUES (?, ?, ?, ?)
    `,
    [notaId, usuarioId, mensagem, data],
    (erro) => {
      if (erro) {
        return res.status(500).send("Erro ao salvar comentário");
      }

      res.send("Comentário salvo com sucesso");
    }
  );
});

app.delete("/comentario/:id", (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM comentarios WHERE id = ?", [id], function (erro) {
    if (erro) {
      return res.status(500).send("Erro ao excluir comentário");
    }

    res.send("Comentário excluído com sucesso");
  });
});

app.get("/notas-estoque", (req, res) => {
  db.all(
    `
    SELECT *,
    CASE
      WHEN LOWER(fornecedor) LIKE '%luporini%' THEN 1
      WHEN LOWER(fornecedor) LIKE '%real%' THEN 2
      WHEN LOWER(fornecedor) LIKE '%vespor%' THEN 3
      WHEN LOWER(fornecedor) LIKE '%pecas brasil%' THEN 4
      WHEN LOWER(fornecedor) LIKE '%peças brasil%' THEN 4
      WHEN LOWER(fornecedor) LIKE '%comdip%' THEN 5
      WHEN LOWER(fornecedor) LIKE '%ptd%' THEN 6
      WHEN LOWER(fornecedor) LIKE '%antonio%' THEN 7
      WHEN LOWER(fornecedor) LIKE '%embrepar%' THEN 8
      WHEN LOWER(fornecedor) LIKE '%lwm%' THEN 9
      ELSE 999
    END as prioridade_fornecedor

    FROM notas
    WHERE status = 'Liberada para estoque'
       OR status = 'Em conferência'
       OR status = 'Conferir ocorrências'

    ORDER BY prioridade_fornecedor ASC, fornecedor ASC
    `,
    (erro, notas) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar notas do estoque");
      }

      res.json(notas);
    }
  );
});

app.delete("/nota/:id", (req, res) => {
  const id = req.params.id;

  db.serialize(() => {
    db.run("DELETE FROM comentarios WHERE nota_id = ?", [id]);
    db.run("DELETE FROM respostas_ocorrencia WHERE ocorrencia_id IN (SELECT id FROM ocorrencias WHERE nota_id = ?)", [id]);
    db.run("DELETE FROM ocorrencias WHERE nota_id = ?", [id]);
    db.run("DELETE FROM itens_nota WHERE nota_id = ?", [id]);

    db.run("DELETE FROM notas WHERE id = ?", [id], (erro) => {
      if (erro) {
        return res.status(500).send("Erro ao excluir nota");
      }

      res.send("Nota excluída com sucesso");
    });
  });
});
app.get("/nota/:id/solicitacoes-finalizadas", (req, res) => {
  const notaId = req.params.id;

  db.all(
    `
    SELECT
      solicitacoes_peca.*,
      usuarios.nome AS vendedor_nome,
      notas.numero AS numero_nota,
      notas.fornecedor AS fornecedor_nota
    FROM solicitacoes_peca
    LEFT JOIN usuarios ON usuarios.id = solicitacoes_peca.vendedor_id
    LEFT JOIN notas ON notas.id = solicitacoes_peca.nota_id
    WHERE solicitacoes_peca.nota_id = ?
    ORDER BY solicitacoes_peca.id DESC
    `,
    [notaId],
    (erro, solicitacoes) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar solicitações da nota");
      }

      res.json(solicitacoes);
    }
  );
});
app.post("/nota/:id/ocorrencias", (req, res) => {
  const notaId = req.params.id;
  const tipo = req.body.tipo || "";
  const titulo = req.body.titulo || "";
  const mensagem = req.body.mensagem || "";
  const criadoPor = req.body.usuario_id;
  const criadoEm = new Date().toISOString();

  if (!titulo.trim() || !mensagem.trim()) {
    return res.status(400).send("Preencha título e mensagem");
  }

  db.run(
    `
    INSERT INTO ocorrencias (
      nota_id,
      tipo,
      titulo,
      mensagem,
      status,
      criado_por,
      criado_em
    )
    VALUES (?, ?, ?, ?, 'Aberta', ?, ?)
    `,
    [notaId, tipo, titulo, mensagem, criadoPor, criadoEm],
    (erro) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao criar ocorrência");
      }

      res.send("Ocorrência criada com sucesso");
    }
  );
});
app.get("/ocorrencias/:id/respostas", (req, res) => {
  const ocorrenciaId = req.params.id;

  db.all(
    `
    SELECT
      respostas_ocorrencia.*,
      usuarios.nome AS usuario_nome
    FROM respostas_ocorrencia
    LEFT JOIN usuarios ON usuarios.id = respostas_ocorrencia.usuario_id
    WHERE respostas_ocorrencia.ocorrencia_id = ?
    ORDER BY respostas_ocorrencia.id ASC
    `,
    [ocorrenciaId],
    (erro, respostas) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar respostas");
      }

      res.json(respostas);
    }
  );
});
app.post("/ocorrencias/:id/respostas", (req, res) => {
  const ocorrenciaId = req.params.id;
  const usuarioId = req.body.usuario_id;
  const mensagem = req.body.mensagem || "";
  const criadoEm = new Date().toISOString();

  if (!mensagem.trim()) {
    return res.status(400).send("Resposta vazia");
  }

  db.run(
    `
    INSERT INTO respostas_ocorrencia (
      ocorrencia_id,
      usuario_id,
      mensagem,
      criado_em
    )
    VALUES (?, ?, ?, ?)
    `,
    [ocorrenciaId, usuarioId, mensagem, criadoEm],
    (erro) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao responder ocorrência");
      }

      res.send("Resposta salva com sucesso");
    }
  );
});
app.post("/ocorrencias/:id/status", (req, res) => {
  const ocorrenciaId = req.params.id;
  const status = req.body.status;

  db.run(
    `
    UPDATE ocorrencias
    SET status = ?
    WHERE id = ?
    `,
    [status, ocorrenciaId],
    (erro) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao atualizar ocorrência");
      }

      res.send("Status da ocorrência atualizado");
    }
  );
});
app.post("/nota/:id/codigos-loja", (req, res) => {
  const notaId = req.params.id;
  const codigos = req.body.codigos || [];

  if (!Array.isArray(codigos)) {
    return res.status(400).send("Formato inválido");
  }

  db.all(
    "SELECT id FROM itens_nota WHERE nota_id = ? ORDER BY id ASC",
    [notaId],
    (erro, itens) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar itens");
      }

      if (codigos.length !== itens.length) {
        return res.status(400).send(
          `Quantidade diferente. A nota tem ${itens.length} itens, mas você colou ${codigos.length} códigos.`
        );
      }

      const stmt = db.prepare(
        "UPDATE itens_nota SET codigo_loja = ? WHERE id = ?"
      );

      itens.forEach((item, index) => {
        stmt.run(codigos[index], item.id);
      });

      stmt.finalize((erro) => {
        if (erro) {
          console.log(erro);
          return res.status(500).send("Erro ao salvar códigos");
        }

        res.send("Códigos internos salvos com sucesso");
      });
    }
  );
});
app.post("/solicitacoes-peca", (req, res) => {
  const vendedorId = req.body.vendedor_id;
  const codigoLoja = String(req.body.codigo_loja || "").trim();
  const quantidadeSolicitada = Number(req.body.quantidade || 1);
  const mensagem = req.body.mensagem || "";
  const criadoEm = new Date().toISOString();

  if (!vendedorId || !codigoLoja) {
    return res.status(400).send("Informe o vendedor e o código da loja");
  }

  if (quantidadeSolicitada <= 0) {
    return res.status(400).send("Quantidade inválida");
  }

  db.get(
    `
    SELECT 
      itens_nota.*,
      notas.id AS nota_id,
      notas.numero AS numero_nota,
      notas.status AS status_nota
    FROM itens_nota
    JOIN notas ON notas.id = itens_nota.nota_id
    WHERE itens_nota.codigo_loja = ?
    ORDER BY notas.id DESC, itens_nota.id ASC
    LIMIT 1
    `,
    [codigoLoja],
    (erro, item) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar peça");
      }

      if (!item) {
        db.run(
          `
          INSERT INTO solicitacoes_peca (
            vendedor_id,
            nota_id,
            item_id,
            codigo_loja,
            descricao,
            quantidade_solicitada,
            status,
            mensagem,
            criado_em
          )
          VALUES (?, NULL, NULL, ?, '', ?, 'Não encontrada', ?, ?)
          `,
          [vendedorId, codigoLoja, quantidadeSolicitada, mensagem, criadoEm],
          (erro) => {
            if (erro) {
              console.log(erro);
              return res.status(500).send("Erro ao criar solicitação");
            }

            res.send("Solicitação criada: peça não encontrada em nenhuma nota");
          }
        );

        return;
      }

      db.get(
        `
        SELECT COALESCE(SUM(quantidade_solicitada), 0) AS total_solicitado
        FROM solicitacoes_peca
        WHERE item_id = ?
        AND status NOT IN ('Cancelada')
        `,
        [item.id],
        (erro, saldo) => {
          if (erro) {
            console.log(erro);
            return res.status(500).send("Erro ao calcular saldo");
          }

          const quantidadeNota = Number(item.quantidade || 0);
          const jaSolicitado = Number(saldo.total_solicitado || 0);
          const disponivel = quantidadeNota - jaSolicitado;

          let status = "Encontrada em nota";

          if (disponivel <= 0 || quantidadeSolicitada > disponivel) {
          return res.status(400).send(`Sem saldo disponível. Quantidade da nota: ${quantidadeNota}, já solicitado: ${jaSolicitado}, disponível: ${disponivel}.`);}
          db.run(
            `
            INSERT INTO solicitacoes_peca (
              vendedor_id,
              nota_id,
              item_id,
              codigo_loja,
              descricao,
              quantidade_solicitada,
              status,
              mensagem,
              criado_em
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              vendedorId,
              item.nota_id,
              item.id,
              codigoLoja,
              item.descricao || "",
              quantidadeSolicitada,
              status,
              mensagem,
              criadoEm
            ],
            (erro) => {
              if (erro) {
                console.log(erro);
                return res.status(500).send("Erro ao criar solicitação");
              }

              res.send(`Solicitação criada: ${status}`);
            }
          );
        }
      );
    }
  );
});
app.get("/solicitacoes-peca", (req, res) => {
  db.all(
    `
    SELECT
      solicitacoes_peca.*,
      usuarios.nome AS vendedor_nome,
      notas.numero AS numero_nota,
      notas.fornecedor AS fornecedor_nota
    FROM solicitacoes_peca
    LEFT JOIN usuarios
      ON usuarios.id = solicitacoes_peca.vendedor_id
    LEFT JOIN notas
      ON notas.id = solicitacoes_peca.nota_id
    WHERE solicitacoes_peca.status NOT IN ('Entregue', 'Cancelada')
    ORDER BY solicitacoes_peca.id DESC
    `,
    (erro, solicitacoes) => {
      if (erro) {
        console.log("ERRO AO BUSCAR SOLICITAÇÕES:", erro);
        return res.status(500).send("Erro ao buscar solicitações");
      }

      res.json(solicitacoes);
    }
  );
});

app.post("/solicitacoes-peca/:id/status", (req, res) => {
  const id = req.params.id;
  const status = req.body.status;

  db.run(
    `
    UPDATE solicitacoes_peca
    SET status = ?
    WHERE id = ?
    `,
    [status, id],
    (erro) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao atualizar status");
      }

      res.send("Status atualizado");
    }
  );
});
app.get("/vendedor/:id/solicitacoes-peca", (req, res) => {
  const vendedorId = req.params.id;

  db.all(
    `
    SELECT
      solicitacoes_peca.*,
      usuarios.nome AS vendedor_nome,
      notas.numero AS numero_nota,
      notas.fornecedor AS fornecedor_nota
    FROM solicitacoes_peca
    LEFT JOIN usuarios ON usuarios.id = solicitacoes_peca.vendedor_id
    LEFT JOIN notas ON notas.id = solicitacoes_peca.nota_id
    WHERE solicitacoes_peca.vendedor_id = ?
    ORDER BY solicitacoes_peca.id DESC
    `,
    [vendedorId],
    (erro, solicitacoes) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar solicitações do vendedor");
      }

      res.json(solicitacoes);
    }
  );
});
app.get("/solicitacoes-peca/:id/respostas", (req, res) => {
  const solicitacaoId = req.params.id;

  db.all(
    `
    SELECT
      respostas_solicitacao_peca.*,
      usuarios.nome AS usuario_nome
    FROM respostas_solicitacao_peca
    LEFT JOIN usuarios ON usuarios.id = respostas_solicitacao_peca.usuario_id
    WHERE respostas_solicitacao_peca.solicitacao_id = ?
    ORDER BY respostas_solicitacao_peca.id ASC
    `,
    [solicitacaoId],
    (erro, respostas) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar respostas");
      }

      res.json(respostas);
    }
  );
});
app.post("/solicitacoes-peca/:id/respostas", (req, res) => {
  const solicitacaoId = req.params.id;
  const usuarioId = req.body.usuario_id;
  const mensagem = req.body.mensagem || "";
  const criadoEm = new Date().toISOString();

  if (!mensagem.trim()) {
    return res.status(400).send("Resposta vazia");
  }

  db.run(
    `
    INSERT INTO respostas_solicitacao_peca (
      solicitacao_id,
      usuario_id,
      mensagem,
      criado_em
    )
    VALUES (?, ?, ?, ?)
    `,
    [solicitacaoId, usuarioId, mensagem, criadoEm],
    (erro) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao salvar resposta");
      }

      res.send("Resposta salva");
    }
  );
});
app.get("/nota/:id/ocorrencias", (req, res) => {
  const notaId = req.params.id;

  db.all(
    `
    SELECT 
      ocorrencias.*,
      usuarios.nome AS criado_por_nome
    FROM ocorrencias
    LEFT JOIN usuarios ON usuarios.id = ocorrencias.criado_por
    WHERE ocorrencias.nota_id = ?
    ORDER BY ocorrencias.id DESC
    `,
    [notaId],
    (erro, ocorrencias) => {
      if (erro) {
        console.log(erro);
        return res.status(500).send("Erro ao buscar ocorrências");
      }

      res.json(ocorrencias);
    }
  );
});
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});