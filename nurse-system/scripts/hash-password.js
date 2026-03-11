const bcrypt = require("bcryptjs");

const password = process.argv[2] || "admin1234";
const rounds = 10;

bcrypt.hash(password, rounds).then((hash) => {
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
});
