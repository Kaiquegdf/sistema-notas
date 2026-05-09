function criarNavbar() {

  const usuario = getUsuarioLogado();

  if (!usuario) {
    return;
  }

  let links = "";

  if (usuario.cargo === "admin") {

    links = `
      <a href="/admin.html">Dashboard</a>
      <a href="/notas.html">Notas Ativas</a>
      <a href="/notas-finalizadas.html">Finalizadas</a>
      <a href="/ocorrencias.html">Ocorrências</a>
      <a href="/usuarios.html">Usuários</a>
    `;
  }

  if (usuario.cargo === "estoque") {

    links = `
      <a href="/estoque.html">Estoque</a>
      <a href="/solicitacoes.html">Solicitações</a>
    `;
  }

  if (usuario.cargo === "vendedor") {

    links = `
      <a href="/painel-vendedor.html">Solicitações</a>
      <a href="/consulta-peca.html">Consultar peças</a>
    `;
  }

  document.body.insertAdjacentHTML(
    "afterbegin",
    `
    <nav class="navbar">
      <div class="navbar-links">
        ${links}
      </div>

      <div class="navbar-user">
        ${usuario.nome}
        <button onclick="logout()">
          Sair
        </button>
      </div>
    </nav>
    `
  );
}