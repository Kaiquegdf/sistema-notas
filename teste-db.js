const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("banco.db");

db.get("SELECT COUNT(*) as total FROM notas", (err, row) => {
  console.log("NOTAS:", row);

  db.get("SELECT COUNT(*) as total FROM itens_nota", (err2, row2) => {
    console.log("ITENS:", row2);

    db.all("SELECT * FROM itens_nota LIMIT 5", (e, rows) => {
      console.log(rows);
    });
  });
});