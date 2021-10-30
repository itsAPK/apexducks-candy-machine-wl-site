import { useEffect, useState } from "react";
import styled from "styled-components";
import Countdown from "react-countdown";
import { Button, CircularProgress, Snackbar,withStyles,Typography} from "@material-ui/core";
import Alert from "@material-ui/lab/Alert";



import * as anchor from "@project-serum/anchor";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletDialogButton } from "@solana/wallet-adapter-material-ui";

import {
  CandyMachine,
  awaitTransactionSignatureConfirmation,
  getCandyMachineState,
  mintOneToken,
  // eslint-disable-next-line
  shortenAddress,
} from "./candy-machine";

import logo from './logo.png';
import svglogo from './navlogo.png';



const ConnectButton = withStyles({
  root: {
    background: '#000000',
    borderRadius: 5,
    border: 2,
    color: '#ffbedf',
    height: 48,
    fontSize : '15px',
    overflow :'hidden',
    fontWeight : 1000,
    padding: '0 30px',
    boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
  },
  label: {
    textTransform: 'capitalize',
  },
})(WalletDialogButton);

const NavBar=styled.nav`
height: 85px;
display: flex;
justify-content: space-between;
z-index: 12;
padding:  30px;
font-weight :  1000;
font-size : 50px;

@media screen and (max-width: 768px) {
display: flex;
flex-direction: column;
justify-content: center;
align-items: center;
padding:  30px;
font-weight :  1000;
font-size : 30px;
}`

const CounterText = styled.span`
overflow : hidden;
`; // add your styles here

const MintContainer = styled.div`
display: flex;
flex-direction: column;
justify-content: center;
align-items: center;
padding:  50px;
font-weight :  1000;
font-size : 30px;
`; // add your styles here

const MintButton = withStyles({
  root: {
    background: 'black',
    borderRadius: 5,
    border: 0,
    color: '#ffbedf;',
    height: 70,
    width : 300,
    fontSize : '18px',
    overflow :'hidden',
    fontWeight : 1000,
    padding: '0 30px',
    boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
  },
  label: {
    textTransform: 'capitalize',
  },
})(Button); // add your styles here


//eslint-disable-next-line
const SecondryDiv=styled.div`
display: flex;
flex-direction: column;
justify-content: center;
align-items: center;
font-weight :  1000;
font-size : 30px;

`
// add your styles here



export interface HomeProps {
  candyMachineId: anchor.web3.PublicKey;
  config: anchor.web3.PublicKey;
  connection: anchor.web3.Connection;
  startDate: number;
  treasury: anchor.web3.PublicKey;
  txTimeout: number;
}

const Home = (props: HomeProps) => {
  // eslint-disable-next-line
  const [api_url, setUrl] = useState(process.env.REACT_APP_API_URL)
  // eslint-disable-next-line
  const [balance, setBalance] = useState<number>();
  const [isActive, setIsActive] = useState(false); // true when countdown completes
  const [isSoldOut, setIsSoldOut] = useState(false); // true when items remaining is zero
  const [isMinting, setIsMinting] = useState(false); // true when user got to press MINT
  const [isWhitelisted, SetWhitelisted] = useState(false);

  const [itemsAvailable, setItemsAvailable] = useState(0);
  const [itemsRedeemed, setItemsRedeemed] = useState(0);
  // eslint-disable-next-line
  const [itemsRemaining, setItemsRemaining] = useState(0);

  const [alertState, setAlertState] = useState<AlertState>({
    open: false,
    message: "",
    severity: undefined,
  });

  const [startDate, setStartDate] = useState(new Date(props.startDate));

  const wallet = useAnchorWallet();
  const [candyMachine, setCandyMachine] = useState<CandyMachine>();
  const refreshCandyMachineState = () => {
    (async () => {
      if (!wallet) return;

      const {
        candyMachine,
        goLiveDate,
        itemsAvailable,
        itemsRemaining,
        itemsRedeemed,
      } = await getCandyMachineState(
        wallet as anchor.Wallet,
        props.candyMachineId,
        props.connection
      );

      setItemsAvailable(itemsAvailable);
      setItemsRemaining(itemsRemaining);
      setItemsRedeemed(itemsRedeemed);

      setIsSoldOut(itemsRemaining === 0);
      setStartDate(goLiveDate);
      setCandyMachine(candyMachine);

    })();
  };

  const onMint = async () => {
    try {
      let res = await fetch(`http://localhost:5000/whitelisted/member/${(wallet as anchor.Wallet).publicKey.toString()}`, {method: "GET"})
      
      const res_json = await res.json()
      const res_num = await JSON.parse(JSON.stringify(res_json)).reserve //The number  of reserves the user has left
      if(!isWhitelisted){
        throw new Error("You are not whitelisted");
      }
      if(res_num - 1 < 0){
        console.log("confirmed")
        throw new Error("Limit Reached");
      }
      setIsMinting(true);
      if (wallet && candyMachine?.program) {
        const mintTxId = await mintOneToken(
          candyMachine,
          props.config,
          wallet.publicKey,
          props.treasury
        );

        const status = await awaitTransactionSignatureConfirmation(
          mintTxId,
          props.txTimeout,
          props.connection,
          "singleGossip",
          false
        );

        if (!status?.err) {
          setAlertState({
            open: true,
            message: "Congratulations! Mint succeeded!",
            severity: "success",
          });
          const to_send = await JSON.stringify({"reserve": res_num-1})
          await fetch(`http://localhost:5000/whitelisted/update/${(wallet as anchor.Wallet).publicKey.toString()}/${process.env.REACT_APP_SECRET_KEY}`, {
            method: "PUT",
            headers: {
            'Content-Type': 'application/json',
            },
            body: to_send})
          console.log("Updated Reserves for user")

        } else {
          setAlertState({
            open: true,
            message: "Mint failed! Please try again!",
            severity: "error",
          });
        }
      }
    } catch (error: any) {
      // TODO: blech:
      let message = error.message || "Minting failed! Please try again!";
      if (!error.message) {
        if (error.message.indexOf("0x138")) {
        } else if (error.message.indexOf("0x137")) {
          message = `SOLD OUT!`;
        } else if (error.message.indexOf("0x135")) {
          message = `Insufficient funds to mint. Please fund your wallet.`;
        }
      } else {
        if (error.code === 311) {
          message = `SOLD OUT!`;
          setIsSoldOut(true);
        } else if (error.code === 312) {
          message = `Minting period hasn't started yet.`;
        } else if (error.message === "You are not whitelisted"){
          message = error.message;
        } else if (error.message === "Your minting limit reached"){
          message = error.message
        }
      }

      setAlertState({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
      }
      setIsMinting(false);
      refreshCandyMachineState();
    }
  };

  useEffect(() => {
    (async () => {
      if (wallet) {
        const balance = await props.connection.getBalance(wallet.publicKey);
        setBalance(balance / LAMPORTS_PER_SOL);
        const data = await fetch(`http://localhost:5000/whitelisted/member/${(wallet as anchor.Wallet).publicKey.toString()}`)
        if(data.status.toString() !== "404"){
          SetWhitelisted(true)
        }
        else{
          console.log("not found")
        }
      }
    })();
  }, [wallet, props.connection]);

  useEffect(refreshCandyMachineState, [
    wallet,
    props.candyMachineId,
    props.connection,
  ]);

  return (
    <main>
      <NavBar>
      <img src={svglogo} alt='apexducks logo' style={{width :"400px", height:"60px"}}/>
      
      
      </NavBar>
      <SecondryDiv> <img src={logo} alt='apexducks logo' /></SecondryDiv>
     
      <MintContainer>
          {!wallet ?(<ConnectButton>Connect Wallet</ConnectButton>)
          :(<MintButton
      
            color="primary"
            disabled={!isWhitelisted || isSoldOut || isMinting || !isActive} //change happened here
            onClick={onMint}
            variant="contained"
            style= {{ display : 'inline-block'}}
            
          >
            {isSoldOut ? (
              "SOLD OUT"
            ) : (!isWhitelisted ? ("You're not Whitelisted")
            : (isActive ? (
              isMinting ? (
                <CircularProgress />
              ) : (
                <div>
                <Typography variant="h4" display="block" style={{fontFamily : 'Segoe UI', fontWeight : 1000, marginBottom: '5px'}}>MINT </Typography>
                
                <Typography variant="subtitle1" display="block"  style={{fontFamily : 'Segoe UI', fontWeight : 1000, marginBottom: '5px'}}>{itemsRedeemed} / {itemsAvailable} NFT Minted</Typography>
              </div>
              )
            ) : (
              <Countdown
                date={startDate}
                onMount={({ completed }) => completed && setIsActive(true)}
                onComplete={() => setIsActive(true)}
                renderer={renderCounter}
              />
            )))}

          </MintButton>
          )}
      </MintContainer>
     

      <Snackbar
        open={alertState.open}
        autoHideDuration={6000}
        onClose={() => setAlertState({ ...alertState, open: false })}
      >
        <Alert
          onClose={() => setAlertState({ ...alertState, open: false })}
          severity={alertState.severity}
        >
          {alertState.message}
        </Alert>
      </Snackbar>
    </main>
  );
};

interface AlertState {
  open: boolean;
  message: string;
  severity: "success" | "info" | "warning" | "error" | undefined;
}

const renderCounter = ({ days, hours, minutes, seconds, completed }: any) => {
  return (
    <CounterText>
      MINTING STARTS IN <br/>{hours + (days || 0) * 24} : {minutes} : {seconds}
    </CounterText>
  );
};

export default Home;
