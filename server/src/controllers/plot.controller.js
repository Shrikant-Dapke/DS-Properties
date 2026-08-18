import { success } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as plotService from '../services/plot.service.js';

export const create = asyncHandler(async (req, res) => {
  const plot = await plotService.createPlot(req.body);
  success(res, plot, 'Plot created', 201);
});

export const list = asyncHandler(async (req, res) => {
  const result = await plotService.listPlots(req.query);
  success(res, result, 'Plots retrieved');
});

export const getOne = asyncHandler(async (req, res) => {
  const plot = await plotService.getPlot(req.params.id);
  success(res, plot, 'Plot retrieved');
});

export const update = asyncHandler(async (req, res) => {
  const plot = await plotService.updatePlot(req.params.id, req.body);
  success(res, plot, 'Plot updated');
});

export const remove = asyncHandler(async (req, res) => {
  await plotService.deletePlot(req.params.id);
  success(res, null, 'Plot deleted');
});
