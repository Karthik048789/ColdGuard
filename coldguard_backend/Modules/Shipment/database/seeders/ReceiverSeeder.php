<?php

namespace Modules\Shipment\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Shipment\App\Models\Receiver;

class ReceiverSeeder extends Seeder
{
    public function run(): void
    {
        $receivers = [
            [
                'name'         => 'Dr. Priya Sharma',
                'email'        => 'priya.sharma@gmcgoa.in',
                'phone'        => '+91 98201 11001',
                'organization' => 'Goa Medical College & Hospital',
                'designation'  => 'Chief Medical Officer',
            ],
            [
                'name'         => 'Nurse Anita Naik',
                'email'        => 'anita.naik@southgoahospital.in',
                'phone'        => '+91 98201 22002',
                'organization' => 'South Goa District Hospital',
                'designation'  => 'Head Nurse – Pharmacy',
            ],
            [
                'name'         => 'Dr. Rohan Dessai',
                'email'        => 'rohan.dessai@phcgoa.in',
                'phone'        => '+91 98201 33003',
                'organization' => 'Primary Health Centre, Margao',
                'designation'  => 'Medical Officer',
            ],
            [
                'name'         => 'Pharmacist Vikram Patel',
                'email'        => 'vikram.pharmacy@healthgoa.in',
                'phone'        => '+91 98201 44004',
                'organization' => 'Goa State Health Department',
                'designation'  => 'Chief Pharmacist',
            ],
            [
                'name'         => 'Dr. Meera Kamat',
                'email'        => 'meera.kamat@aiimsgoa.in',
                'phone'        => '+91 98201 55005',
                'organization' => 'AIIMS Goa',
                'designation'  => 'Associate Professor – Medicine',
            ],
            [
                'name'         => 'Cold Store Admin',
                'email'        => 'coldstore@goamedical.in',
                'phone'        => '+91 98201 66006',
                'organization' => 'Goa Cold Storage Unit',
                'designation'  => 'Facility Administrator',
            ],
        ];

        foreach ($receivers as $data) {
            Receiver::updateOrCreate(['email' => $data['email']], $data);
        }

        $this->command->info('✅ ReceiverSeeder: 6 receivers seeded.');
    }
}
