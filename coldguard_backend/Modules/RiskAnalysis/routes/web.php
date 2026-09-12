<?php

use Illuminate\Support\Facades\Route;
use Modules\RiskAnalysis\App\Http\Controllers\RiskAnalysisController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('riskanalyses', RiskAnalysisController::class)->names('riskanalysis');
});
