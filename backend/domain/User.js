class User {
  constructor({ id, name, email }) {
    this.id = id;
    this.name = name;
    this.email = email;
  }

  changeEmail(newEmail) {
    this.email = newEmail;
  }

  rename(newName) {
    this.name = newName;
  }
}

module.exports = User;