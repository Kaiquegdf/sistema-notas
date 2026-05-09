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

  if (
    cargosPermitidos.length > 0 &&
    !cargosPermitidos.includes(usuario.cargo)
  ) {
    alert("Você não tem permissão para acessar esta página.");

    redirecionarLogin();

    return null;
  }

  return usuario;
}

function logout() {
  localStorage.removeItem("usuario");
  redirecionarLogin();
}