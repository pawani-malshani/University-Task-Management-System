function validateTask(req, res, next) {
  const { title, status, priority, due_date, dueDate } = req.body;
  const errors = {};
  const isUpdate = req.method === 'PUT' || req.method === 'PATCH';

  // For creation (POST), title is required.
  // For update (PUT/PATCH), title is validated only if it was included in the request body.
  if (!isUpdate) {
    if (!title || typeof title !== 'string' || title.trim() === '') {
      errors.title = 'Title is required and cannot be blank.';
    } else if (title.trim().length > 150) {
      errors.title = 'Title must not exceed 150 characters.';
    }
  } else if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      errors.title = 'Title cannot be blank.';
    } else if (title.trim().length > 150) {
      errors.title = 'Title must not exceed 150 characters.';
    }
  }

  // Validate status if provided
  const validStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
  if (status && !validStatuses.includes(String(status).toUpperCase())) {
    errors.status = `Status must be one of: ${validStatuses.join(', ')}`;
  }

  // Validate priority if provided
  const validPriorities = ['LOW', 'MEDIUM', 'HIGH'];
  if (priority && !validPriorities.includes(String(priority).toUpperCase())) {
    errors.priority = `Priority must be one of: ${validPriorities.join(', ')}`;
  }

  // Validate date if supplied
  const dateVal = due_date || dueDate;
  if (dateVal && isNaN(Date.parse(dateVal))) {
    errors.dueDate = 'Due date must be a valid date format (YYYY-MM-DD).';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      status: 400,
      error: 'Bad Request',
      message: Object.values(errors)[0],
      errors,
      timestamp: new Date().toISOString()
    });
  }

  // Normalize casing
  if (req.body.status) req.body.status = String(req.body.status).toUpperCase();
  if (req.body.priority) req.body.priority = String(req.body.priority).toUpperCase();

  next();
}

module.exports = { validateTask };
