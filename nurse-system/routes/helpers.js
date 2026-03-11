function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function toMysqlDateTime(input) {
  const date = input ? new Date(input) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function parseIntOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

module.exports = {
  asyncHandler,
  toMysqlDateTime,
  parseIntOrNull
};
