<?php
/**
 * osTicket Ticket Webhook Plugin
 *
 * Sends an HTTP POST webhook with JSON ticket details when a new ticket
 * is created in selected departments. Supports Basic Auth, multi-instance
 * configuration, and department filtering.
 *
 * @see https://github.com/osTicket/osTicket
 */
return array(
    'id'          => 'pearl:hermes-agent-webhook',
    'version'     => '1.2.0',
    'name'        => 'Hermes Agent Ticket Webhook',
    'author'      => 'Pearl Diffusion / osTicket Community',
    'description' => 'Sends asynchronous ticket creation and client-reply webhooks to Hermes Agent and exposes a secured callback endpoint to add Hermes proposals as internal notes. Supports osTicket 1.18.x, department filtering, Basic Auth, shared-secret callbacks, multi-instance configuration, and reverse-proxy environments.',
    'url'         => 'https://github.com/Aior/osticket-hermes-agent-plugin',
    'ost_version' => '1.18',
    'plugin'      => 'include/class.ticket-webhook.php:TicketWebhookPlugin',
);
