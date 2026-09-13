<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('update:receiver', function () {
    $s = \Modules\Shipment\App\Models\Shipment::find(24);
    if ($s) {
        $s->receiver_email = 'priya.sharma@gmcgoa.in';
        $s->receiver_name = 'Dr. Priya Sharma';
        $s->save();
        $this->info("Shipment 24 updated with receiver: {$s->receiver_email}");
    }
});
