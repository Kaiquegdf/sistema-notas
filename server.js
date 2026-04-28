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
      data TEXT
      cte TEXT,
      complemento_manual TEXT,
      prioridade TEXT,
      responsavel_atual TEXT,
      pendencia_admin TEXT,
      acao_necessaria TEXT,
      tipo_ocorrencia TEXT
    )
  `);

  db.run(`ALTER TABLE notas ADD COLUMN status_administrativo TEXT DEFAULT 'Importada'`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN status_estoque TEXT DEFAULT 'Aguardando liberação'`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN status_marcacao TEXT DEFAULT 'Não liberada'`, () => {});

  db.run(`ALTER TABLE notas ADD COLUMN valor_frete TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN volumes TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN transportadora TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN cnpj_transportadora TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN vencimento TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN valor_boleto TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN complemento_icms TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN cte TEXT`, () => {});
  db.run(`ALTER TABLE notas ADD COLUMN observacoes TEXT`, () => {});
  db.run("ALTER TABLE notas ADD COLUMN markup_nota TEXT", () => {});

  db.run(`
    CREATE TABLE IF NOT EXISTS itens_nota (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nota_id INTEGER,
      codigo TEXT,
      descricao TEXT,
      quantidade TEXT,
      valor_unitario TEXT,
      valor_total TEXT
    )
  `);

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
  res.send("Sistema rodando");
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
          complemento_icms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          complemento
        ],
        function (erro) {
          if (erro) {
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

            db.run(
              `
              INSERT INTO itens_nota (
                nota_id,
                codigo,
                descricao,
                quantidade,
                valor_unitario,
                valor_total
              )
              VALUES (?, ?, ?, ?, ?, ?)
              `,
              [notaId, codigo, descricao, quantidade, valorUnitario, valorTotal]
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
      return res.send("Erro ao buscar notas");
    }

    res.json(linhas);
  });
});

app.get("/nota/:id", (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM notas WHERE id = ?", [id], (erro, nota) => {
    if (erro) {
      return res.send("Erro ao buscar nota");
    }

    res.json(nota);
  });
});

app.get("/nota/:id/itens", (req, res) => {
  const id = req.params.id;

  db.all("SELECT * FROM itens_nota WHERE nota_id = ?", [id], (erro, itens) => {
    if (erro) {
      return res.send("Erro ao buscar itens");
    }

    res.json(itens);
  });
});

app.get("/usuarios", (req, res) => {
  db.all("SELECT * FROM usuarios", (erro, usuarios) => {
    if (erro) {
      return res.send("Erro ao buscar usuários");
    }

    res.json(usuarios);
  });
});

app.get("/nota/:id/comentarios", (req, res) => {
  const id = req.params.id;

  db.all(
    `
    SELECT comentarios.id, comentarios.mensagem, comentarios.data, usuarios.nome, usuarios.perfil
    FROM comentarios
    JOIN usuarios ON usuarios.id = comentarios.usuario_id
    WHERE comentarios.nota_id = ?
    ORDER BY comentarios.id ASC
    `,
    [id],
    (erro, comentarios) => {
      if (erro) {
        return res.send("Erro ao buscar comentários");
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

  db.run(
    "INSERT INTO comentarios (nota_id, usuario_id, mensagem, data) VALUES (?, ?, ?, ?)",
    [notaId, usuarioId, mensagem, data],
    (erro) => {
      if (erro) {
        return res.send("Erro ao salvar comentário");
      }

      res.send("Comentário salvo com sucesso");
    }
  );
});

app.post("/nota/:id/status", (req, res) => {
  const id = req.params.id;

  const statusAdministrativo = req.body.status_administrativo;
  const statusEstoque = req.body.status_estoque;
  const statusMarcacao = req.body.status_marcacao;

  db.run(
    `
    UPDATE notas
    SET status_administrativo = ?,
        status_estoque = ?,
        status_marcacao = ?
    WHERE id = ?
    `,
    [statusAdministrativo, statusEstoque, statusMarcacao, id],
    (erro) => {
      if (erro) {
        return res.send("Erro ao atualizar status");
      }

      res.send("Status atualizado com sucesso");
    }
  );
});

app.post("/nota/:id/admin", (req, res) => {
    const id = req.params.id

    const {
        complemento_manual,
        prioridade,
        responsavel_atual,
        pendencia_admin,
        acao_necessaria,
        tipo_ocorrencia
    } = req.body

db.run(`
    UPDATE notas
    SET
        complemento_manual = ?,
        prioridade = ?,
        responsavel_atual = ?,
        pendencia_admin = ?,
        acao_necessaria = ?,
        tipo_ocorrencia = ?
    WHERE id = ?
`, [
    complemento_manual,
    prioridade,
    responsavel_atual,
    pendencia_admin,
    acao_necessaria,
    tipo_ocorrencia,
    id
], (err) => {
    if (err) {
        return res.status(500).send("Erro ao salvar")
    }

    res.send("Salvo com sucesso")
})
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
app.get("/notas-estoque", (req, res) => {
  db.all(`
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
    END as prioridade

    FROM notas
    WHERE status_estoque = 'Liberada para conferência'
       OR status_estoque = 'Em conferência'

    ORDER BY prioridade ASC, fornecedor ASC
  `,
  (erro, notas) => {
    if (erro) {
      console.log(erro);
      return res.status(500).send("Erro ao buscar notas");
    }

    res.json(notas);
  });
});
app.delete("/nota/:id", (req, res) => {
  const id = req.params.id;

  db.serialize(() => {
    db.run("DELETE FROM comentarios WHERE nota_id = ?", [id]);
    db.run("DELETE FROM itens_nota WHERE nota_id = ?", [id]);
    db.run("DELETE FROM notas WHERE id = ?", [id], (erro) => {
      if (erro) {
        return res.send("Erro ao excluir nota");
      }

      res.send("Nota excluída com sucesso");
    });
  });
});
app.post("/nota/:id/markup", (req, res) => {
  const id = req.params.id;
  const markup = String(req.body.markup).replace(",", ".");

  if (isNaN(Number(markup))) {
    return res.status(400).send("Markup inválido");
  }

  db.serialize(() => {
    db.run(
      "UPDATE notas SET markup_nota = ? WHERE id = ?",
      [markup, id]
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
app.delete("/comentario/:id", (req, res) => {
  const id = req.params.id;

  db.run("DELETE FROM comentarios WHERE id = ?", [id], function (erro) {
    if (erro) {
      return res.status(500).send("Erro ao excluir comentário");
    }

    res.send("Comentário excluído com sucesso");
  });
});
app.post("/nota/:id/avancar-etapa", (req, res) => {
  const id = req.params.id;

  db.get("SELECT * FROM notas WHERE id = ?", [id], (erro, nota) => {
    if (erro || !nota) {
      return res.status(404).send("Nota não encontrada");
    }

    let statusAdministrativo = nota.status_administrativo;
    let statusEstoque = nota.status_estoque;
    let statusMarcacao = nota.status_marcacao;

    if (statusAdministrativo === "Importada") {
      statusAdministrativo = "Em análise administrativa";
    } else if (statusAdministrativo === "Em análise administrativa") {
      statusAdministrativo = "Liberada para estoque";
      statusEstoque = "Liberada para conferência";
    } else if (statusEstoque === "Liberada para conferência") {
      statusEstoque = "Em conferência";
    } else if (statusEstoque === "Em conferência") {
      statusEstoque = "Conferida sem ocorrência";
      statusMarcacao = "Liberada para marcação";
    } else if (statusMarcacao === "Liberada para marcação") {
      statusMarcacao = "Marcada";
      statusAdministrativo = "Finalizada";
    } else {
      return res.send("A nota já está finalizada ou não possui próxima etapa.");
    }

    db.run(
      `
      UPDATE notas
      SET status_administrativo = ?,
          status_estoque = ?,
          status_marcacao = ?
      WHERE id = ?
      `,
      [statusAdministrativo, statusEstoque, statusMarcacao, id],
      (erro) => {
        if (erro) {
          return res.status(500).send("Erro ao avançar etapa");
        }

        res.send("Etapa avançada com sucesso");
      }
    );
  });
});
app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});