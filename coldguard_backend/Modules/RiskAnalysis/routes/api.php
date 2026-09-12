<?php

use Illuminate\Support\Facades\Route;
use Modules\RiskAnalysis\App\Http\Controllers\RiskAnalysisController;

/*
|--------------------------------------------------------------------------
| Risk Analysis API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('shipments/{id}')->group(function () {
    Route::post('/analyze-risk', [RiskAnalysisController::class, 'analyze']);
    Route::get('/risk-events', [RiskAnalysisController::class, 'index']);
    Route::get('/risk-events/latest', [RiskAnalysisController::class, 'latest']);
});
