import { success } from '../utils/response.js';
import * as plotService from '../services/plot.service.js';

export async function create(req, res, next) {
  try {
    const plot = await plotService.createPlot(req.body);
    success(res, plot, 'Plot created', 201);
  } catch (err) {
    next(err);
  }
}

export async function list(req, res, next) {
  try {
    const result = await plotService.listPlots(req.query);
    success(res, result, 'Plots retrieved');
  } catch (err) {
    next(err);
  }
}

export async function getOne(req, res, next) {
  try {
    const plot = await plotService.getPlot(req.params.id);
    success(res, plot, 'Plot retrieved');
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const plot = await plotService.updatePlot(req.params.id, req.body);
    success(res, plot, 'Plot updated');
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    await plotService.deletePlot(req.params.id);
    success(res, null, 'Plot deleted');
  } catch (err) {
    next(err);
  }
}
