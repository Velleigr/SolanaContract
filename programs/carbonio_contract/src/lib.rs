use anchor_lang::prelude::*;

// fill with solana playground
declare_id!("4cEitCyjjmqrULg1anfYmKDqEPwfRTWZ4F2u3FBbkrso");

#[program]
pub mod company_registration {
    use super::*;


    pub fn register_company(
        ctx: Context<RegisterCompany>,
        name: String,
        description: String,
        field: Vec<String>,
        contact_name: String,
        contact_email: String,
        phone_number: String,
        wallet_address: String,
    ) -> Result<()> {
        //We get a mutable reference to the company account that will store the data.
        let company_account = &mut ctx.accounts.company_account;

        company_account.name = name;
        company_account.description = description;
        company_account.field = field;
        company_account.contact_name = contact_name;
        company_account.contact_email = contact_email;
        company_account.phone_number = phone_number;
        company_account.wallet_address = wallet_address;
        company_account.authority = ctx.accounts.authority.key();

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterCompany<'info> {
    #[account(
        init,
        seeds = [b"company", name.as_bytes()],
        bump,
        payer = authority,
        space = 8 + Company::MAX_SIZE,
    )]
    //Init: Tells Solana to create a new account.
    //seeds = [b"company", name.as_bytes()]: Used to derive a PDA based on the company name.
    pub company_account: Account<'info, Company>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Company {
    pub name: String,
    pub description: String,
    pub field: Vec<String>,
    pub contact_name: String,
    pub contact_email: String,
    pub phone_number: String,
    pub wallet_address: String,
    pub authority: Pubkey,
}

// // Manual size estimate for space (adjust as needed)
impl Company {
    pub const MAX_SIZE: usize = 4 + 100  // name
        + 4 + 300  // description
        + 4 + (30 * 20) // field (30 strings avg 20 bytes)
        + 4 + 100 // contact_name
        + 4 + 100 // contact_email
        + 4 + 20  // phone_number
        + 4 + 50  // wallet_address
        + 32;     // authority pubkey
}
