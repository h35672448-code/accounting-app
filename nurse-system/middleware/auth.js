const jwt = require("jsonwebtoken");

function unauthorized(message = "Unauthorized") {
  const error = new Error(message);
  error.status = 401;
  return error;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return next(unauthorized("Missing bearer token"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return next(unauthorized("Invalid or expired token"));
  }
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      const error = new Error("Forbidden");
      error.status = 403;
      return next(error);
    }

    return next();
  };
}

module.exports = {
  authenticateToken,
  authorizeRoles
};
