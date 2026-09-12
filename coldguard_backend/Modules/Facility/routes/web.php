<?php

use Illuminate\Support\Facades\Route;
use Modules\Facility\App\Http\Controllers\FacilityController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('facilities', FacilityController::class)->names('facility');
});
