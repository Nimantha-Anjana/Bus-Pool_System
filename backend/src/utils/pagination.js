const { Op } = require("sequelize");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Pagination is OPT-IN so existing clients keep working:
//   no ?page / ?limit  -> null (caller returns every row, like before)
//   ?page=2&limit=20   -> { page: 2, limit: 20, offset: 20 }
const getPagination = (query = {}) => {
  if (query.page === undefined && query.limit === undefined) return null;

  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  return { page, limit, offset: (page - 1) * limit };
};

const buildMeta = (paging, total) => ({
  page: paging.page,
  limit: paging.limit,
  total,
  totalPages: Math.ceil(total / paging.limit),
});

// Page through a model that has hasMany includes without Sequelize's LIMIT + JOIN problems:
//   1) find ONE page of ids (cheap query, only belongsTo includes allowed in `idInclude`)
//   2) load the full records (with all includes) for just those ids, in the same order
const loadPage = async (Model, { where, order, idInclude = [], fullInclude = [], fullOrder, paging }) => {
  const { count, rows } = await Model.findAndCountAll({
    where,
    order,
    include: idInclude,
    attributes: ["id"],
    limit: paging.limit,
    offset: paging.offset,
    distinct: true,
    raw: true,
  });

  const total = Array.isArray(count) ? count.length : count;
  const ids = rows.map((row) => row.id);

  if (!ids.length) return { rows: [], meta: buildMeta(paging, total) };

  const records = await Model.findAll({
    where: { id: { [Op.in]: ids } },
    include: fullInclude,
    order: fullOrder || order,
  });

  return { rows: records, meta: buildMeta(paging, total) };
};

module.exports = { getPagination, buildMeta, loadPage };
