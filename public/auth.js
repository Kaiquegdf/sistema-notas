function getUsuarioLogado() {
  return JSON.parse(localStorage.getItem("usuario"));
}

function redirecionarLogin() {
  window.location.href = "/login.html";
}

function verificarLogin() {
  const usuario = getUsuarioLogado();

  if (!usuario) {
    redirecionarLogin();
    return null;
  }

  return usuario;
}

function verificarPermissao(cargosPermitidos = []) {

  const usuario = verificarLogin();

  if (!usuario) {
    return null;
  }

  const cargo =
    usuario.cargo.toLowerCase().trim();

  const permitidos =
    cargosPermitidos.map(c =>
      c.toLowerCase().trim()
    );

  if (
    permitidos.length > 0 &&
    !permitidos.includes(cargo)
  ) {

    alert("Sem permissão");

    redirecionarLogin();

    return null;
  }

  return usuario;
}

function logout() {
  localStorage.removeItem("usuario");
  redirecionarLogin();
}
const usuario =
  JSON.parse(localStorage.getItem("usuario"));

if(!usuario){

  window.location.href =
    "/login.html";
}