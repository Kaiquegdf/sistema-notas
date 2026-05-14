function criarNavbar() {

  const usuario =
    JSON.parse(localStorage.getItem("usuario"));

  if (!usuario) return;

  let links = "";

  if (
    usuario.cargo.toLowerCase() === "admin"
  ) {

    links += `
      <a href="/usuarios.html">Usuários</a>
    `;
  }

  if (
    usuario.cargo.toLowerCase() === "admin" ||
    usuario.cargo.toLowerCase() === "administrativo"
  ) {

    links += `
      <a href="/admin.html">Dashboard</a>
      <a href="/notas.html">Notas</a>
      <a href="/ocorrencias.html">Ocorrências</a>
    `;
  }

  if (
    usuario.cargo.toLowerCase() === "estoque"
  ) {

    links += `
      <a href="/estoque.html">Estoque</a>
    `;
  }

  if (
    usuario.cargo.toLowerCase() === "vendedor"
  ) {

    links += `
      <a href="/painel-vendedor.html">Solicitações</a>
    `;
  }

  document.body.insertAdjacentHTML(
    "afterbegin",
    `
    <nav class="topbar">

      <button
        class="menu-btn"
        onclick="abrirMenu()"
      >
        ☰
      </button>

      <div class="logo">
        JOLUPE
      </div>

      <div class="usuario-topo">
        ${usuario.nome}
      </div>

    </nav>

    <div
      class="overlay"
      id="overlay"
      onclick="fecharMenu()"
    ></div>

    <div
      class="sidebar"
      id="sidebar"
    >

      <div class="sidebar-topo">
        MENU
      </div>

      <div class="sidebar-links">

        ${links}

        <a href="#"
           onclick="logout()">
          Sair
        </a>

      </div>

    </div>
    `
  );
}

function abrirMenu(){

  document
    .getElementById("sidebar")
    .classList.add("ativo");

  document
    .getElementById("overlay")
    .classList.add("ativo");
}

function fecharMenu(){

  document
    .getElementById("sidebar")
    .classList.remove("ativo");

  document
    .getElementById("overlay")
    .classList.remove("ativo");
}