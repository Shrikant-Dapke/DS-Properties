import { ValidationError } from '../utils/errors.js';

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { value, error } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
      }));
      return next(new ValidationError('Validation failed', details));
    }
    if (source === 'query') {
      // req.query is getter-only in Express 5; replace its contents in place.
      for (const key of Object.keys(req.query)) delete req.query[key];
      Object.assign(req.query, value);
    } else {
      req[source] = value;
    }
    return next();
  };
}