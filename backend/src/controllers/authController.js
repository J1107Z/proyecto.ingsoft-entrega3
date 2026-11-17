const authService = require('../services/authService');

function wrapAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

const register = wrapAsync(async (req, res) => {
  const result = await authService.registerUser(req.body);
  res.status(201).json(result);
});

const login = wrapAsync(async (req, res) => {
  const result = await authService.loginUser(req.body);
  res.status(200).json(result);
});

const me = wrapAsync(async (req, res) => {
  const usuario = await authService.getProfile(req.user.id_usuario);
  res.status(200).json({ usuario });
});

module.exports = {
  register,
  login,
  me,
};
